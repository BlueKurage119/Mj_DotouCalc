// 牌ID: riichi-rs-bundlers と同じエンコーディング
// 1-9: 萬子, 10-18: 筒子, 19-27: 索子, 28-31: 東南西北, 32-34: 白發中
export type TileId = number

export interface TileInstance {
  t: TileId
  red?: boolean // 赤5
}

export const EAST = 28
export const SOUTH = 29
export const WEST = 30
export const NORTH = 31
export const HAKU = 32
export const HATSU = 33
export const CHUN = 34

export const ALL_TILES: TileId[] = Array.from({ length: 34 }, (_, i) => i + 1)

export function isHonor(t: TileId): boolean {
  return t >= 28
}

export function isWind(t: TileId): boolean {
  return t >= 28 && t <= 31
}

/** 数牌なら 1-9、字牌なら 0 */
export function numOf(t: TileId): number {
  return isHonor(t) ? 0 : ((t - 1) % 9) + 1
}

/** 'm' | 'p' | 's' | 'z' */
export function suitOf(t: TileId): 'm' | 'p' | 's' | 'z' {
  if (t <= 9) return 'm'
  if (t <= 18) return 'p'
  if (t <= 27) return 's'
  return 'z'
}

export function isFive(t: TileId): boolean {
  return numOf(t) === 5
}

/** ドラ表示牌 → ドラ牌 */
export function doraFromIndicator(ind: TileId): TileId {
  if (ind <= 27) {
    const n = numOf(ind)
    return n === 9 ? ind - 8 : ind + 1
  }
  if (isWind(ind)) return ind === NORTH ? EAST : ind + 1
  return ind === CHUN ? HAKU : ind + 1
}

const HONOR_NAMES = ['東', '南', '西', '北', '白', '發', '中']
const NUM_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const SUIT_NAMES = { m: '萬', p: '筒', s: '索' } as const

/** 表示名 (例: 五萬 / 東 / 赤五筒) */
export function tileName(inst: TileInstance | TileId): string {
  const t = typeof inst === 'number' ? inst : inst.t
  const red = typeof inst === 'number' ? false : !!inst.red
  if (isHonor(t)) return HONOR_NAMES[t - 28]
  const base = `${NUM_KANJI[numOf(t) - 1]}${SUIT_NAMES[suitOf(t) as 'm' | 'p' | 's']}`
  return red ? `赤${base}` : base
}

/** 短縮表記 (例: 5m / 0p(赤) / E) */
export function tileShort(inst: TileInstance | TileId): string {
  const t = typeof inst === 'number' ? inst : inst.t
  const red = typeof inst === 'number' ? false : !!inst.red
  if (isHonor(t)) return 'ESWNPFC'[t - 28]
  return `${red ? 0 : numOf(t)}${suitOf(t)}`
}

/** 種類ごとの枚数を数える */
export function countByTile(tiles: TileId[]): Map<TileId, number> {
  const m = new Map<TileId, number>()
  for (const t of tiles) m.set(t, (m.get(t) ?? 0) + 1)
  return m
}
