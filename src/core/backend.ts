import { calc } from 'riichi-rs-bundlers'
import type { TileId } from './tiles'

// 役ID (riichi-rs-bundlers の Yaku 定数と同じ)
export const YAKU_ROUND_WINDS = [42, 43, 44, 45]
export const YAKU_ID = { dora: 53, uradora: 54, akadora: 55 } as const

export interface BackendInput {
  /** 門前部分。ツモの場合は和了牌を末尾に含める。ロンの場合は和了牌を含めない */
  closed: TileId[]
  melds: { open: boolean; tiles: TileId[] }[]
  /** ロン牌 (ツモなら null) */
  ronTile: TileId | null
  seatWind: TileId
  roundWind: TileId
  /** 場風役 (役牌:場風) を無効にする */
  disableRoundWindYaku: boolean
  riichi: boolean
  doubleRiichi: boolean
  ippatsu: boolean
  afterKan: boolean
  lastTile: boolean
  kuitan: boolean
  doubleYakuman: boolean
}

export interface BackendResult {
  agari: boolean
  /** 和了形だが役がない */
  noYaku: boolean
  yakuman: number
  han: number
  fu: number
  /** 役ID → 翻数 */
  yaku: Record<number, number>
}

const INVALID: BackendResult = { agari: false, noYaku: false, yakuman: 0, han: 0, fu: 0, yaku: {} }

/**
 * riichi-rs-bundlers アダプタ。
 * ドラ・赤は渡さず役と符だけ計算させる (ドラは almighty.ts で自前計算)。
 * 点数(支払い額)も payment.ts で自前計算するため ten は使わない。
 */
export function calcBackend(input: BackendInput): BackendResult {
  try {
    const r = calc({
      closed_part: input.closed as never,
      open_part: input.melds.map((m) => [m.open, m.tiles]) as never,
      options: {
        dora: [],
        aka_count: 0,
        allow_aka: false,
        riichi: input.riichi,
        double_riichi: input.doubleRiichi,
        ippatsu: input.ippatsu,
        after_kan: input.afterKan,
        last_tile: input.lastTile,
        tile_discarded_by_someone: (input.ronTile ?? -1) as never,
        bakaze: input.roundWind as never,
        jikaze: input.seatWind as never,
        allow_kuitan: input.kuitan,
        with_kiriage: false,
        allow_double_yakuman: input.doubleYakuman,
        disabled_yaku: (input.disableRoundWindYaku ? YAKU_ROUND_WINDS : []) as never,
      },
      calc_hairi: false,
    })
    if (!r.is_agari) return INVALID
    return {
      agari: true,
      noYaku: false,
      yakuman: r.yakuman,
      han: r.han,
      fu: r.fu,
      yaku: r.yaku as Record<number, number>,
    }
  } catch (e) {
    if (String(e).includes('no yaku')) {
      return { ...INVALID, agari: true, noYaku: true }
    }
    return INVALID
  }
}

export interface HairiResult {
  /** 向聴数 (0 = 聴牌) */
  now: number
  /** 待ち牌 (13枚相当のとき) */
  waits: TileId[]
  /** 打牌 → その後の待ち牌 (14枚相当のとき。最良向聴を保つ打牌のみ) */
  waitsAfterDiscard: [TileId, TileId[]][]
}

/**
 * 向聴・待ち計算。和了形が完成している場合は null を返す。
 * 注意: riichi-rs-bundlers の hairi 出力は牌IDが0始まり (入力は1始まり) のため+1補正する。
 */
export function calcHairi(
  closed: TileId[],
  melds: { open: boolean; tiles: TileId[] }[],
): HairiResult | null {
  try {
    const r = calc({
      closed_part: closed as never,
      open_part: melds.map((m) => [m.open, m.tiles]) as never,
      options: { dora: [], aka_count: 0, allow_aka: false, allow_kuitan: true },
      calc_hairi: true,
    })
    if (r.is_agari) return null
    if (!r.hairi) return null
    return {
      now: r.hairi.now,
      waits: r.hairi.wait.map((t) => t + 1),
      waitsAfterDiscard: r.hairi.waits_after_discard.map(
        ([d, ws]) => [d + 1, ws.map((t) => t + 1)] as [TileId, TileId[]],
      ),
    }
  } catch {
    // 'no yaku' = 和了形は完成している
    return null
  }
}
