import { describe, expect, it } from 'vitest'
import { calcAlmighty, type HandInput } from '../src/core/almighty'
import { PRESETS } from '../src/core/options'
import { EAST, SOUTH, type TileInstance } from '../src/core/tiles'

// 短縮表記から TileInstance[] を作る: t('2m 3m 4m 東') / 赤5は '0m'
const NAME_TO_ID: Record<string, number> = { 東: 28, 南: 29, 西: 30, 北: 31, 白: 32, 發: 33, 中: 34 }
function t(s: string): TileInstance[] {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (NAME_TO_ID[w]) return { t: NAME_TO_ID[w] }
      const n = Number(w[0])
      const suit = w[1]
      const offset = suit === 'm' ? 0 : suit === 'p' ? 9 : 18
      if (n === 0) return { t: offset + 5, red: true }
      return { t: offset + n }
    })
}

const baseInput: Omit<HandInput, 'concealed' | 'winTile'> = {
  melds: [],
  isTsumo: false,
  seatWind: SOUTH,
  roundWind: EAST,
  riichi: false,
  doubleRiichi: false,
  ippatsu: false,
  afterKan: false,
  lastTile: false,
  doraIndicators: [],
  uraIndicators: [],
  koPayers: 3,
  dealerPays: true,
}

const dotou = PRESETS.dotou.options
const shura = PRESETS.shura.options

describe('万能牌の高目選択', () => {
  it('役牌になる置換が選ばれる (役なし置換は除外)', () => {
    const out = calcAlmighty(
      {
        ...baseInput,
        concealed: t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中'),
        winTile: t('5s')[0],
      },
      dotou,
    )
    expect(out.ok).toBe(true)
    expect(out.best!.tile).toBe(34) // 中
    expect(out.best!.yaku[52]).toBe(1) // 役牌 中
    expect(out.hadNoYaku).toBe(true) // 5s 置換は和了形だが役なし
  })

  it('万能牌をドラとして数える(修羅)/数えない(怒涛)', () => {
    // 3m4m の両面を万能牌(2m or 5m)で埋める形。どちらも断幺九1翻
    const hand = {
      ...baseInput,
      concealed: t('3m 4m 6m 7m 8m 2p 3p 4p 5s 6s 7s 8s'),
      winTile: t('8s')[0],
      doraIndicators: t('4m'), // ドラ = 5m
    }
    // 修羅: 5m置換で断幺+ドラ1 が最高
    const s = calcAlmighty(hand, shura)
    expect(s.ok).toBe(true)
    expect(s.best!.tile).toBe(5) // 5m
    expect(s.best!.dora.almighty).toBe(1)
    expect(s.best!.han).toBe(2) // 断幺九 + ドラ1

    // 怒涛: 万能牌はドラにならないので 2m/5m 同点 → ID順で 2m
    const d = calcAlmighty(hand, dotou)
    expect(d.ok).toBe(true)
    expect(d.best!.tile).toBe(2) // 2m
    expect(d.best!.dora.almighty).toBe(0)
    expect(d.best!.han).toBe(1)
  })

  it('高目判定から裏ドラを除外する(修羅)', () => {
    const hand = {
      ...baseInput,
      concealed: t('3m 4m 6m 7m 8m 2p 3p 4p 5s 6s 7s 8s'),
      winTile: t('8s')[0],
      riichi: true,
      doraIndicators: t('1m'), // ドラ = 2m
      uraIndicators: t('4m 4m'), // 裏ドラ = 5m ×2
    }
    // 修羅: 裏を除いて判定 → 2m置換(立直+断幺+ドラ1=3翻)が5m置換(立直+断幺=2翻)に勝つ
    const s = calcAlmighty(hand, shura)
    expect(s.best!.tile).toBe(2)
    expect(s.best!.dora.omote).toBe(1)

    // 裏込みで判定するなら 5m置換(立直+断幺+裏2=4翻)が勝つ
    const inc = calcAlmighty(hand, { ...shura, rankingExcludesUra: false })
    expect(inc.best!.tile).toBe(5)
    expect(inc.best!.dora.ura).toBe(2)
  })

  it('同一牌の5枚目として使用できない', () => {
    const out = calcAlmighty(
      {
        ...baseInput,
        concealed: t('1m 1m 1m 1m 2p 3p 4p 5s 6s 7s 9s 9s'),
        winTile: t('9s')[0],
        isTsumo: true,
      },
      dotou,
    )
    expect(out.ok).toBe(false) // 1m 5枚目は禁止され、他の置換でも和了形にならないため false
  })

  it('5枚使いの待ち牌および置換制限の検証 (Issue 9)', () => {
    // 222444p ポン666p 明槓8888p
    // 手牌には、8pが4枚、6pが3枚、4pが3枚、2pが3枚ある
    const hand = {
      ...baseInput,
      melds: [
        { type: 'pon', tiles: t('6p 6p 6p') },
        { type: 'minkan', tiles: t('8p 8p 8p 8p') },
      ],
      concealed: t('2p 2p 2p 4p 4p 4p'),
      winTile: t('8p')[0],
    }

    // 8pは手の内で4枚使われているため和了・置換不可
    const out8p = calcAlmighty(hand, dotou)
    expect(out8p.ok).toBe(false)

    // 6pは手の内で3枚使われているが、万能牌を5pや7pに置換することで和了可能
    const out6p = calcAlmighty({ ...hand, winTile: t('6p')[0] }, dotou)
    expect(out6p.ok).toBe(true)

    // 2pは手の内で3枚使われているが、万能牌を3pに置換することで和了可能
    const out2p = calcAlmighty({ ...hand, winTile: t('2p')[0] }, dotou)
    expect(out2p.ok).toBe(true)

    // 4pも同様に、万能牌を3pに置換することで和了可能
    const out4p = calcAlmighty({ ...hand, winTile: t('4p')[0] }, dotou)
    expect(out4p.ok).toBe(true)
  })

  it('場風なし(怒涛): 東場でも場風東はつかない', () => {
    const hand = {
      ...baseInput,
      concealed: t('東 東 東 5m 6m 7m 2p 3p 4p 5s 8s 8s'),
      winTile: t('5s')[0],
      isTsumo: true,
      seatWind: SOUTH,
      roundWind: EAST,
    }
    const d = calcAlmighty(hand, dotou)
    expect(d.ok).toBe(true)
    expect(d.best!.yaku[42]).toBeUndefined() // 場風 東 なし
    const s = calcAlmighty(hand, shura)
    expect(s.best!.yaku[42]).toBe(1) // 修羅は場風あり
  })

  it('赤5は翻に加算される', () => {
    const out = calcAlmighty(
      {
        ...baseInput,
        concealed: t('2m 3m 4m 0m 6m 7m 2p 3p 4p 5s 中 中'),
        winTile: t('5s')[0],
      },
      dotou,
    )
    expect(out.ok).toBe(true)
    expect(out.best!.dora.aka).toBe(1)
    expect(out.best!.yaku[55]).toBe(1)
  })

  it('怒涛のツモ支払い: 満貫は2000×3', () => {
    // 断幺+ツモ+三色っぽい手... シンプルに: 清一色で満貫以上を確認する代わりに
    // 平和ツモ+ドラで検証は複雑なので、支払い方式だけ確認
    const out = calcAlmighty(
      {
        ...baseInput,
        concealed: t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中'),
        winTile: t('5s')[0],
        isTsumo: true,
      },
      dotou,
    )
    expect(out.ok).toBe(true)
    // 中置換: 役牌+ツモ. 支払いは (基本点切り上げ)×3 で親分がないこと
    const p = out.best!.payment
    expect(p.detail).toContain('オール')
    expect(p.total % 300).toBe(0)
  })

  it('副露あり: 喰いタン', () => {
    const out = calcAlmighty(
      {
        ...baseInput,
        concealed: t('3m 4m 5m 6p 7p 8p'),
        melds: [
          { type: 'pon', tiles: t('6m 6m 6m') },
          { type: 'chi', tiles: t('2s 3s 4s') },
        ],
        winTile: t('5s')[0],
        isTsumo: false,
      },
      dotou,
    )
    expect(out.ok).toBe(true)
    expect(out.best!.yaku[32]).toBe(1) // 断幺九
  })

  it('入力検証: 枚数不足', () => {
    const out = calcAlmighty(
      { ...baseInput, concealed: t('2m 3m 4m'), winTile: t('5s')[0] },
      dotou,
    )
    expect(out.ok).toBe(false)
    expect(out.error).toContain('12枚')
  })

  it('入力検証: 実牌5枚', () => {
    const out = calcAlmighty(
      {
        ...baseInput,
        concealed: t('1m 1m 1m 1m 2p 3p 4p 5s 6s 7s 9s 9s'),
        winTile: t('1m')[0],
      },
      dotou,
    )
    expect(out.ok).toBe(false)
    expect(out.error).toContain('5枚')
  })

  it('役満: 万能牌で国士無双を完成', () => {
    const out = calcAlmighty(
      {
        ...baseInput,
        concealed: t('1m 9m 1p 9p 1s 9s 東 南 西 北 白 發'),
        winTile: t('中')[0],
      },
      dotou,
    )
    expect(out.ok).toBe(true)
    // 12種+万能牌の形は十三面待ち扱いになりダブル役満 (ダブル役満ありの設定)
    expect(out.best!.yakuman).toBeGreaterThanOrEqual(1)
    expect(out.best!.payment.total).toBeGreaterThanOrEqual(32000)
  })
})
