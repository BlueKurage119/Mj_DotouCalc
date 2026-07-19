// 聴牌分析 (待ち牌と点数) と 何切る分析 (聴牌を保つ打牌候補)
import { calcAlmighty, type Candidate, type HandInput } from './almighty'
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

/** 和了牌・ツモロン区別を除いた手の状況 */
export type AnalysisInput = Omit<HandInput, 'winTile' | 'isTsumo'>

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

export interface DiscardInfo {
  tile: TileId
  /** この牌を切った後の待ち牌 */
  waits: TileId[]
  /** 待ち牌の残り枚数合計 */
  totalRemaining: number
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

function backendMelds(input: AnalysisInput) {
  return input.melds.map((m) => ({ open: m.type !== 'ankan', tiles: m.tiles.map((x) => x.t) }))
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
    const ron = calcAlmighty({ ...input, winTile, isTsumo: false }, opts)
    const tsumo = calcAlmighty({ ...input, winTile, isTsumo: true }, opts)
    waits.push({
      tile: w,
      remaining: remainingOf(w, input),
      ron: ron.ok ? (ron.best ?? null) : null,
      tsumo: tsumo.ok ? (tsumo.best ?? null) : null,
      noYaku: !ron.ok && !tsumo.ok,
    })
  }
  return { ok: true, tenpai: true, waits }
}

/**
 * 何切る分析: 手牌 (13-3×副露) + 万能牌 のとき、聴牌を保つ打牌候補と打牌後の待ち。
 * 万能牌は打牌できないため、候補は実牌に限る。
 */
export function analyzeDiscards(input: AnalysisInput): DiscardsOutcome {
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
      const waits = [...ws].sort((a, b) => a - b)
      // 打牌後の残り枚数: 打牌自身が待ちに含まれる場合もあるが近似として現在の見え牌基準
      const totalRemaining = waits.reduce((acc, w) => acc + remainingOf(w, input), 0)
      return { tile, waits, totalRemaining }
    })
    .sort((a, b) => b.totalRemaining - a.totalRemaining || a.tile - b.tile)

  return { ok: true, tsumoWinPossible, discards }
}
