import { isHonor, numOf, suitOf, type TileInstance } from '../core/tiles'

const HONOR_CHARS = ['東', '南', '西', '北', '白', '發', '中']
const NUM_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const SUIT_CHARS = { m: '萬', p: '筒', s: '索' } as const

/** テキストベースの牌表示 */
export function TileFace({ tile }: { tile: TileInstance }) {
  const { t, red } = tile
  if (isHonor(t)) {
    const c = HONOR_CHARS[t - 28]
    return (
      <span className={`tile-face honor ${t === 34 ? 'chun' : t === 33 ? 'hatsu' : ''}`}>{c}</span>
    )
  }
  const suit = suitOf(t) as 'm' | 'p' | 's'
  return (
    <span className={`tile-face suit-${suit}`}>
      <span className={`tile-num${red ? ' red' : ''}`}>{red ? '赤' : NUM_KANJI[numOf(t) - 1]}</span>
      <span className="tile-suit">{red ? `五${SUIT_CHARS[suit]}` : SUIT_CHARS[suit]}</span>
    </span>
  )
}

/** 万能牌の表示 */
export function AlmightyFace() {
  return <span className="tile-face almighty">万能</span>
}
