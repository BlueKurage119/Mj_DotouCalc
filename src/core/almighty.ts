// 万能牌(オールマイティ)の置換全列挙と高目判定
import { calcBackend } from './backend'
import { calcPayment, type Payment } from './payment'
import type { RuleOptions } from './options'
import {
  ALL_TILES,
  EAST,
  countByTile,
  doraFromIndicator,
  tileName,
  type TileId,
  type TileInstance,
} from './tiles'

export type MeldType = 'chi' | 'pon' | 'minkan' | 'ankan'

export interface MeldInput {
  type: MeldType
  tiles: TileInstance[] // chi/pon: 3枚, minkan/ankan: 4枚
}

export interface HandInput {
  /** 門前手牌 (万能牌・和了牌を除く)。副露なしなら12枚 */
  concealed: TileInstance[]
  melds: MeldInput[]
  winTile: TileInstance
  isTsumo: boolean
  seatWind: TileId // 28-31
  roundWind: TileId
  riichi: boolean
  doubleRiichi: boolean
  ippatsu: boolean
  afterKan: boolean // 嶺上開花(ツモ) / 搶槓(ロン)
  lastTile: boolean // 海底/河底
  doraIndicators: TileInstance[]
  uraIndicators: TileInstance[]
  /** ツモ時に支払う子の人数 (和了済・飛びの家は除く) */
  koPayers: number
  /** standard・自分が子のツモ時、親が支払うか */
  dealerPays: boolean
}

export interface DoraDetail {
  omote: number
  ura: number
  aka: number
  /** 万能牌によるドラ (omote/ura に含まれる内数) */
  almighty: number
}

export interface Candidate {
  /** 万能牌をこの牌として解釈 */
  tile: TileId
  yakuman: number
  /** 合計翻 (ドラ込み) */
  han: number
  fu: number
  /** 役ID → 翻数 (ドラ 53/54/55 も含めて表示用に格納) */
  yaku: Record<number, number>
  dora: DoraDetail
  payment: Payment
  /** 高目判定に使った点数 */
  rankTotal: number
}

export interface CalcOutcome {
  ok: boolean
  error?: string
  best?: Candidate
  /** 和了形になる全候補 (高目順) */
  candidates: Candidate[]
  /** 和了形になるが役がない置換が存在したか */
  hadNoYaku: boolean
}

function fail(error: string): CalcOutcome {
  return { ok: false, error, candidates: [], hadNoYaku: false }
}

export function validateHand(input: HandInput): string | null {
  for (const m of input.melds) {
    const need = m.type === 'chi' || m.type === 'pon' ? 3 : 4
    if (m.tiles.length !== need) return '副露の牌数が不正です'
  }
  const expected = 12 - 3 * input.melds.length
  if (input.concealed.length !== expected) {
    return `手牌は${expected}枚必要です (現在${input.concealed.length}枚)`
  }
  // 実牌は各種4枚まで (万能牌の置換のみ5枚目になり得る)
  const all: TileInstance[] = [
    ...input.concealed,
    ...input.melds.flatMap((m) => m.tiles),
    input.winTile,
    ...input.doraIndicators,
    ...input.uraIndicators,
  ]
  const counts = countByTile(all.map((x) => x.t))
  for (const [t, c] of counts) {
    if (c > 4) return `${tileName(t)} が5枚以上あります`
  }
  const redCounts = new Map<string, number>()
  for (const x of all) {
    if (x.red) redCounts.set(String(x.t), (redCounts.get(String(x.t)) ?? 0) + 1)
  }
  for (const [, c] of redCounts) {
    if (c > 1) return '赤5は各色1枚までです'
  }
  return null
}

function countMatches(tiles: TileId[], doraList: TileId[]): number {
  let n = 0
  for (const t of tiles) for (const d of doraList) if (t === d) n++
  return n
}

export function calcAlmighty(input: HandInput, opts: RuleOptions): CalcOutcome {
  const err = validateHand(input)
  if (err) return fail(err)

  const isDealer = opts.payment === 'standard' && input.seatWind === EAST
  const doraList = input.doraIndicators.map((x) => doraFromIndicator(x.t))
  const uraList = input.riichi ? input.uraIndicators.map((x) => doraFromIndicator(x.t)) : []

  const realTiles: TileInstance[] = [
    ...input.concealed,
    ...input.melds.flatMap((m) => m.tiles),
    input.winTile,
  ]
  const realIds = realTiles.map((x) => x.t)
  const akaCount = realTiles.filter((x) => x.red).length
  const baseOmote = countMatches(realIds, doraList)
  const baseUra = countMatches(realIds, uraList)

  const candidates: Candidate[] = []
  let hadNoYaku = false

  for (const sub of ALL_TILES) {
    const concealedIds = input.concealed.map((x) => x.t).concat([sub]).sort((a, b) => a - b)
    const closed = input.isTsumo ? [...concealedIds, input.winTile.t] : concealedIds
    const r = calcBackend({
      closed,
      melds: input.melds.map((m) => ({ open: m.type !== 'ankan', tiles: m.tiles.map((x) => x.t) })),
      ronTile: input.isTsumo ? null : input.winTile.t,
      seatWind: input.seatWind,
      roundWind: input.roundWind,
      disableRoundWindYaku: !opts.roundWindYaku,
      riichi: input.riichi || input.doubleRiichi,
      doubleRiichi: input.doubleRiichi,
      ippatsu: input.ippatsu,
      afterKan: input.afterKan,
      lastTile: input.lastTile,
      kuitan: opts.kuitan,
      doubleYakuman: opts.doubleYakuman,
    })
    if (!r.agari) continue
    if (r.noYaku) {
      hadNoYaku = true
      continue
    }

    const almightyOmote = opts.almightyDora === 'counted' ? countMatches([sub], doraList) : 0
    const almightyUra = opts.almightyDora === 'counted' ? countMatches([sub], uraList) : 0
    const omote = baseOmote + almightyOmote
    const ura = baseUra + almightyUra

    const isYakuman = r.yakuman > 0
    const doraHan = isYakuman ? 0 : omote + ura + akaCount
    const han = r.han + doraHan

    const yaku: Record<number, number> = { ...r.yaku }
    if (!isYakuman) {
      if (omote > 0) yaku[53] = omote
      if (ura > 0) yaku[54] = ura
      if (akaCount > 0) yaku[55] = akaCount
    }

    const payBase = {
      fu: r.fu,
      yakuman: r.yakuman,
      isTsumo: input.isTsumo,
      mode: opts.payment,
      isDealer,
      koPayers: input.koPayers,
      dealerPays: input.dealerPays,
      kiriage: opts.kiriage,
    }
    const payment = calcPayment({ ...payBase, han })

    // 高目判定用の点数 (設定によりドラ/裏ドラを除いて評価)
    let rankHan = han
    if (!isYakuman) {
      if (opts.rankingExcludesDora) rankHan = r.han
      else if (opts.rankingExcludesUra) rankHan = han - ura
    }
    const rankTotal = rankHan === han ? payment.total : calcPayment({ ...payBase, han: rankHan }).total

    candidates.push({ tile: sub, yakuman: r.yakuman, han, fu: r.fu, yaku, dora: { omote, ura, aka: akaCount, almighty: almightyOmote + almightyUra }, payment, rankTotal })
  }

  candidates.sort(
    (a, b) =>
      b.rankTotal - a.rankTotal ||
      b.payment.total - a.payment.total ||
      b.yakuman - a.yakuman ||
      b.han - a.han ||
      b.fu - a.fu ||
      a.tile - b.tile,
  )

  if (candidates.length === 0) {
    return {
      ok: false,
      error: hadNoYaku
        ? '和了形にはなりますが役がありません'
        : 'どの置換でも和了形になりません',
      candidates: [],
      hadNoYaku,
    }
  }
  return { ok: true, best: candidates[0], candidates, hadNoYaku }
}
