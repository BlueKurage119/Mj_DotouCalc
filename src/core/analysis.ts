// 聴牌分析 (待ち牌と点数) と 何切る分析 (聴牌を保つ打牌候補)
import { calcAlmighty, type Candidate, type CalcOutcome, type HandInput } from './almighty'
import { calcHairi } from './backend'
import type { RuleOptions } from './options'
import {
  ALL_TILES,
  countByTile,
  suitOf,
  tileName,
  type TileId,
  type TileInstance,
} from './tiles'

/**
 * 和了牌・ツモロン区別を除いた手の状況。
 * firstTake (天和・地和) はツモ和了時にのみ意味を持つ概念であり、
 * 聴牌分析・何切る分析はどちらも「まだ和了していない状態」を扱うため対象外。
 */
export type AnalysisInput = Omit<HandInput, 'winTile' | 'isTsumo' | 'firstTake'>

export interface WaitInfo {
  tile: TileId
  /** 見えていない残り枚数 */
  remaining: number
  /** ロン時の最高解釈 (役なしなら null) */
  ron: Candidate | null
  /** ツモ時の最高解釈 (役なしなら null) */
  tsumo: Candidate | null
  /** 和了形にはなるが役がない (形式聴牌) */
  noYaku: boolean
}

export interface WaitsOutcome {
  ok: boolean
  error?: string
  tenpai: boolean
  waits: WaitInfo[]
}

export interface DiscardScoreRange {
  min: number
  max: number
}

export interface DiscardInfo {
  tile: TileId
  /** この牌を切った後の待ち牌 */
  waits: TileId[]
  /** 待ち牌の残り枚数合計 */
  totalRemaining: number
  /**
   * 打牌後の待ちで和了した場合の点数範囲。
   * 現在の状況設定 (立直・一発・裏ドラ等) のまま各待ちをロン・ツモ両方で計算し、
   * 役がつく組み合わせの受け取り合計 (payment.total) の最小〜最大を表す。
   * ロン・ツモとも役なしになる待ち (形式聴牌) は範囲から除外し hasNoYakuWait で示す。
   * 全ての待ちが役なしの場合は null。
   */
  scoreRange: DiscardScoreRange | null
  /** ロン・ツモともに役なしになる待ちが1つ以上あるか */
  hasNoYakuWait: boolean
  /** 振聴 (この牌を切った後の待ちに、切った牌自身が含まれる。例: 2p切り2p待ち) */
  furiten: boolean
}

export interface DiscardsOutcome {
  ok: boolean
  error?: string
  /** 万能牌の解釈により既に和了形 (ツモ和了可能) */
  tsumoWinPossible: boolean
  /** 聴牌を保つ打牌候補 (待ち残り枚数の多い順) */
  discards: DiscardInfo[]
}

function validateTiles(input: AnalysisInput, expectedConcealed: number): string | null {
  for (const m of input.melds) {
    const need = m.type === 'chi' || m.type === 'pon' ? 3 : 4
    if (m.tiles.length !== need) return '副露の牌数が不正です'
  }
  if (input.concealed.length !== expectedConcealed) {
    return `手牌は${expectedConcealed}枚必要です (現在${input.concealed.length}枚)`
  }
  const all = [
    ...input.concealed,
    ...input.melds.flatMap((m) => m.tiles),
    ...input.doraIndicators,
    ...input.uraIndicators,
  ]
  for (const [t, c] of countByTile(all.map((x) => x.t))) {
    if (c > 4) return `${tileName(t)} が5枚以上あります`
  }
  const redSuits = new Set<string>()
  for (const x of all) {
    if (!x.red) continue
    const s = suitOf(x.t)
    if (redSuits.has(s)) return '赤5は各色1枚までです'
    redSuits.add(s)
  }
  return null
}

/** 見えている牌 (手牌・副露・表示牌) から残り枚数を数える */
function remainingOf(tile: TileId, input: AnalysisInput): number {
  const visible = [
    ...input.concealed,
    ...input.melds.flatMap((m) => m.tiles),
    ...input.doraIndicators,
    ...input.uraIndicators,
  ].filter((x) => x.t === tile).length
  return Math.max(0, 4 - visible)
}

function hasAgariShape(ron: CalcOutcome, tsumo: CalcOutcome): boolean {
  return ron.ok || tsumo.ok || ron.hadNoYaku || tsumo.hadNoYaku
}

function backendMelds(input: AnalysisInput) {
  return input.melds.map((m) => ({ open: m.type !== 'ankan', tiles: m.tiles.map((x) => x.t) }))
}

function tilesKey(tiles: TileInstance[]): string {
  return tiles
    .map((x) => (x.red ? `${x.t}r` : `${x.t}`))
    .sort()
    .join(',')
}

/** calcAlmighty の結果は入力から一意に決まるため、同一入力をキーにメモ化する */
const almightyCache = new Map<string, CalcOutcome>()
const ALMIGHTY_CACHE_MAX = 2000

function cachedCalcAlmighty(input: HandInput, opts: RuleOptions): CalcOutcome {
  const key = JSON.stringify([
    tilesKey(input.concealed),
    input.melds
      .map((m) => `${m.type}:${tilesKey(m.tiles)}`)
      .sort()
      .join('|'),
    input.winTile.t,
    !!input.winTile.red,
    input.isTsumo,
    input.firstTake,
    input.seatWind,
    input.roundWind,
    input.riichi,
    input.doubleRiichi,
    input.ippatsu,
    input.afterKan,
    input.lastTile,
    tilesKey(input.doraIndicators),
    tilesKey(input.uraIndicators),
    input.koPayers,
    input.dealerPays,
    opts,
  ])
  const hit = almightyCache.get(key)
  if (hit) return hit
  const r = calcAlmighty(input, opts)
  if (almightyCache.size >= ALMIGHTY_CACHE_MAX) {
    const oldest = almightyCache.keys().next().value
    if (oldest !== undefined) almightyCache.delete(oldest)
  }
  almightyCache.set(key, r)
  return r
}

/**
 * 聴牌分析: 手牌 (12-3×副露) + 万能牌 の待ち牌一覧と各待ちのロン・ツモ点数。
 * 待ちの発見は hairi (万能牌34置換のunion)、点数は calcAlmighty で計算する。
 */
export function analyzeWaits(input: AnalysisInput, opts: RuleOptions): WaitsOutcome {
  const err = validateTiles(input, 12 - 3 * input.melds.length)
  if (err) return { ok: false, error: err, tenpai: false, waits: [] }

  const ids = input.concealed.map((x) => x.t)
  const melds = backendMelds(input)
  const waitSet = new Set<TileId>()
  for (const sub of ALL_TILES) {
    const h = calcHairi([...ids, sub].sort((a, b) => a - b), melds)
    if (h && h.now === 0) for (const w of h.waits) waitSet.add(w)
  }
  if (waitSet.size === 0) return { ok: true, tenpai: false, waits: [] }

  const waits: WaitInfo[] = []
  for (const w of [...waitSet].sort((a, b) => a - b)) {
    const winTile: TileInstance = { t: w }
    const ron = cachedCalcAlmighty({ ...input, winTile, isTsumo: false, firstTake: false }, opts)
    const tsumo = cachedCalcAlmighty({ ...input, winTile, isTsumo: true, firstTake: false }, opts)
    if (!hasAgariShape(ron, tsumo)) continue
    waits.push({
      tile: w,
      remaining: remainingOf(w, input),
      ron: ron.ok ? (ron.best ?? null) : null,
      tsumo: tsumo.ok ? (tsumo.best ?? null) : null,
      noYaku: !ron.ok && !tsumo.ok,
    })
  }
  return { ok: true, tenpai: waits.length > 0, waits }
}

/** 実牌から1枚除去する (赤5でない方を優先。打牌操作 App.tsx:discardTile と同じ考え方) */
function removeOneTile(concealed: TileInstance[], tile: TileId): TileInstance[] {
  let idx = concealed.findIndex((x) => x.t === tile && !x.red)
  if (idx < 0) idx = concealed.findIndex((x) => x.t === tile)
  return concealed.filter((_, i) => i !== idx)
}

/**
 * 何切る分析: 手牌 (13-3×副露) + 万能牌 のとき、聴牌を保つ打牌候補と打牌後の待ち。
 * 万能牌は打牌できないため、候補は実牌に限る。
 * 各打牌候補について、待ちごとにロン・ツモ両方を現在の状況設定 (立直・一発・裏ドラ等) で
 * 計算し、点数範囲 (scoreRange) を付与する。
 */
export function analyzeDiscards(input: AnalysisInput, opts: RuleOptions): DiscardsOutcome {
  const err = validateTiles(input, 13 - 3 * input.melds.length)
  if (err) return { ok: false, error: err, tsumoWinPossible: false, discards: [] }

  const ids = input.concealed.map((x) => x.t)
  const realCounts = countByTile(ids)
  const melds = backendMelds(input)

  let tsumoWinPossible = false
  const discardWaits = new Map<TileId, Set<TileId>>()
  for (const sub of ALL_TILES) {
    const h = calcHairi([...ids, sub].sort((a, b) => a - b), melds)
    if (h === null) {
      // この解釈では既に和了形
      tsumoWinPossible = true
      continue
    }
    if (h.now !== 0) continue
    for (const [d, ws] of h.waitsAfterDiscard) {
      if (!realCounts.has(d)) continue // 万能牌(置換牌)自体は打牌できない
      let set = discardWaits.get(d)
      if (!set) discardWaits.set(d, (set = new Set()))
      for (const w of ws) set.add(w)
    }
  }

  const discards: DiscardInfo[] = [...discardWaits.entries()]
    .map(([tile, ws]) => {
      const after = removeOneTile(input.concealed, tile)

      // 振聴判定: calcHairi の待ち計算は「捨てた牌自身」を構造的に待ちから除外するため
      // (riichi-rust の hairi 実装は捨て牌インデックスを常にスキップする)、
      // 打牌後の手牌で捨てた牌そのものを和了牌として直接判定し直す必要がある。
      // 和了形になる場合は待ち牌一覧・枚数・点数レンジにも他の待ちと同じ扱いで合流させる。
      const selfRon = cachedCalcAlmighty(
        { ...input, concealed: after, winTile: { t: tile }, isTsumo: false, firstTake: false },
        opts,
      )
      const selfTsumo = cachedCalcAlmighty(
        { ...input, concealed: after, winTile: { t: tile }, isTsumo: true, firstTake: false },
        opts,
      )
      const furiten = hasAgariShape(selfRon, selfTsumo)
      if (furiten) ws.add(tile)

      const waits = [...ws].sort((a, b) => a - b)
      const totals: number[] = []
      let hasNoYakuWait = false
      const validWaits: TileId[] = []
      for (const w of waits) {
        const winTile: TileInstance = { t: w }
        const ron = cachedCalcAlmighty(
          { ...input, concealed: after, winTile, isTsumo: false, firstTake: false },
          opts,
        )
        const tsumo = cachedCalcAlmighty(
          { ...input, concealed: after, winTile, isTsumo: true, firstTake: false },
          opts,
        )
        if (!hasAgariShape(ron, tsumo)) continue
        validWaits.push(w)
        if (ron.ok) totals.push(ron.best!.payment.total)
        if (tsumo.ok) totals.push(tsumo.best!.payment.total)
        if (!ron.ok && !tsumo.ok) hasNoYakuWait = true
      }
      const scoreRange: DiscardScoreRange | null = totals.length
        ? { min: Math.min(...totals), max: Math.max(...totals) }
        : null

      const totalRemaining = validWaits.reduce((acc, w) => acc + remainingOf(w, input), 0)

      return { tile, waits: validWaits, totalRemaining, scoreRange, hasNoYakuWait, furiten }
    })
    .filter((d) => d.waits.length > 0)
    .sort((a, b) => b.totalRemaining - a.totalRemaining || a.tile - b.tile)

  return { ok: true, tsumoWinPossible, discards }
}
