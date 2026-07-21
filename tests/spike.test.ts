import { describe, expect, it } from 'vitest'
import { calc, Tile, Yaku } from 'riichi-rs-bundlers'

// riichi-rs-bundlers の挙動検証スパイク
describe('riichi-rs-bundlers spike', () => {
  it('計算できる: 平和ツモ', () => {
    // 234m 567m 234p 567s 88s + ツモ 2m... 手: 23m+風待ちでなく単純な完成形
    const r = calc({
      closed_part: [
        Tile.M2, Tile.M3, Tile.M4,
        Tile.M5, Tile.M6, Tile.M7,
        Tile.P2, Tile.P3, Tile.P4,
        Tile.S5, Tile.S6,
        Tile.S8, Tile.S8,
        Tile.S7, // ツモ牌は末尾
      ],
      open_part: [],
      options: { bakaze: Tile.East, jikaze: Tile.South },
    })
    expect(r.is_agari).toBe(true)
    expect(r.yaku[Yaku.Pinfu]).toBe(1)
    expect(r.yaku[Yaku.Menzentsumo]).toBe(1)
    expect(r.fu).toBe(20)
  })

  it('同一牌5枚を受け付けるか (5枚目使用可ルールに必要)', () => {
    // 111m ×4枚 + 5枚目の1m を含む: 11111m 234p 567s 99s + 頭側で使う形
    const r = calc({
      closed_part: [
        Tile.M1, Tile.M1, Tile.M1, Tile.M1, Tile.M1,
        Tile.P2, Tile.P3, Tile.P4,
        Tile.S5, Tile.S6, Tile.S7,
        Tile.S9, Tile.S9,
        Tile.S9,
      ],
      open_part: [],
      options: { bakaze: Tile.East, jikaze: Tile.South },
    })
    // 111m 11m(頭)... 5枚使い。是非を確認
    // eslint-disable-next-line no-console
    console.log('five-copy result:', JSON.stringify(r))
  })

  it('ドラを自前計算するため dora を渡さなければドラ0', () => {
    const r = calc({
      closed_part: [
        Tile.M2, Tile.M3, Tile.M4,
        Tile.M5, Tile.M6, Tile.M7,
        Tile.P2, Tile.P3, Tile.P4,
        Tile.S5, Tile.S6, Tile.S7,
        Tile.S8,
      ],
      open_part: [],
      options: { bakaze: Tile.East, jikaze: Tile.South, tile_discarded_by_someone: Tile.S8 },
    })
    expect(r.yaku[Yaku.Dora]).toBeUndefined()
  })

  it('場風役を disabled_yaku で無効化できる', () => {
    const base = {
      closed_part: [
        Tile.East, Tile.East, Tile.East,
        Tile.M5, Tile.M6, Tile.M7,
        Tile.P2, Tile.P3, Tile.P4,
        Tile.S5, Tile.S6, Tile.S7,
        Tile.S8, Tile.S8,
      ],
      open_part: [] as [],
    }
    const withBakaze = calc({
      ...base,
      options: { bakaze: Tile.East, jikaze: Tile.East },
    })
    expect(withBakaze.yaku[Yaku.RoundWindEast]).toBe(1)
    expect(withBakaze.yaku[Yaku.OwnWindEast]).toBe(1)

    const disabled = calc({
      ...base,
      options: {
        bakaze: Tile.East,
        jikaze: Tile.East,
        disabled_yaku: [
          Yaku.RoundWindEast, Yaku.RoundWindSouth, Yaku.RoundWindWest, Yaku.RoundWindNorth,
        ],
      },
    })
    expect(disabled.yaku[Yaku.RoundWindEast]).toBeUndefined()
    expect(disabled.yaku[Yaku.OwnWindEast]).toBe(1)
  })

  it('役満: 国士無双', () => {
    const r = calc({
      closed_part: [
        Tile.M1, Tile.M9, Tile.P1, Tile.P9, Tile.S1, Tile.S9,
        Tile.East, Tile.South, Tile.West, Tile.North,
        Tile.Haku, Tile.Hatsu, Tile.Chun, Tile.Chun,
      ],
      open_part: [],
      options: { bakaze: Tile.East, jikaze: Tile.South },
    })
    expect(r.is_agari).toBe(true)
    expect(r.yakuman).toBeGreaterThanOrEqual(1)
  })

  it('副露あり: 喰いタン', () => {
    const r = calc({
      closed_part: [
        Tile.M3, Tile.M4, Tile.M5,
        Tile.P6, Tile.P7, Tile.P8,
        Tile.S5,
      ],
      open_part: [[true, [Tile.S2, Tile.S3, Tile.S4]], [true, [Tile.M6, Tile.M6, Tile.M6]]],
      options: {
        bakaze: Tile.East, jikaze: Tile.South,
        allow_kuitan: true,
        tile_discarded_by_someone: Tile.S5,
      },
    })
    expect(r.is_agari).toBe(true)
    expect(r.yaku[Yaku.Tanyao]).toBe(1)
  })

  it('符とロン点数: 子ロン 40符1翻 = 1300', () => {
    // 111m(暗刻) 456m 789p 234s 99s ロン... 40符になる形: 純チャンでなく単純に
    const r = calc({
      closed_part: [
        Tile.M1, Tile.M1, Tile.M1,
        Tile.M4, Tile.M5, Tile.M6,
        Tile.P7, Tile.P8, Tile.P9,
        Tile.S2, Tile.S3,
        Tile.S9, Tile.S9,
      ],
      open_part: [],
      options: { bakaze: Tile.East, jikaze: Tile.South, riichi: true, tile_discarded_by_someone: Tile.S4 },
    })
    expect(r.is_agari).toBe(true)
    console.log('fu/han/ten:', r.fu, r.han, r.ten)
  })

  // #16 天和・地和対応: first_take オプションの実挙動確認
  it('親のツモ + first_take -> 天和(Yaku.Tenhou)が単独役満として発火する', () => {
    const r = calc({
      closed_part: [
        Tile.M1, Tile.M2, Tile.M3, Tile.M4, Tile.M5, Tile.M6, Tile.M7, Tile.M8, Tile.M9,
        Tile.S1, Tile.S2, Tile.S3,
        Tile.East, Tile.East,
      ],
      open_part: [],
      options: { first_take: true, bakaze: Tile.South, jikaze: Tile.East },
    })
    expect(r.is_agari).toBe(true)
    expect(r.yakuman).toBe(1)
    expect(r.yaku[Yaku.Tenhou]).toBe(13)
    expect(r.yaku[Yaku.Chihou]).toBeUndefined()
  })

  it('子のツモ + first_take -> 地和(Yaku.Chihou)が単独役満として発火する', () => {
    const r = calc({
      closed_part: [
        Tile.M1, Tile.M2, Tile.M3, Tile.M4, Tile.M5, Tile.M6, Tile.M7, Tile.M8, Tile.M9,
        Tile.S1, Tile.S2, Tile.S3,
        Tile.East, Tile.East,
      ],
      open_part: [],
      options: { first_take: true, bakaze: Tile.South, jikaze: Tile.South },
    })
    expect(r.is_agari).toBe(true)
    expect(r.yakuman).toBe(1)
    expect(r.yaku[Yaku.Chihou]).toBe(13)
    expect(r.yaku[Yaku.Tenhou]).toBeUndefined()
  })

  it('ロン + first_take は人和(Yaku.Renhou)を発火せず通常のロン判定になる', () => {
    const r = calc({
      closed_part: [
        Tile.M1, Tile.M2, Tile.M3, Tile.M4, Tile.M5, Tile.M6, Tile.M7, Tile.M8, Tile.M9,
        Tile.S1, Tile.S2, Tile.S3,
        Tile.East,
      ],
      open_part: [],
      options: {
        first_take: true,
        tile_discarded_by_someone: Tile.East,
        bakaze: Tile.South,
        jikaze: Tile.South,
      },
    })
    expect(r.is_agari).toBe(true)
    expect(r.yakuman).toBe(0)
    expect(r.yaku[Yaku.Renhou]).toBeUndefined()
  })

  it('first_take + riichi/last_tile を同時指定しても天和の判定を阻害しない', () => {
    const r = calc({
      closed_part: [
        Tile.M1, Tile.M2, Tile.M3, Tile.M4, Tile.M5, Tile.M6, Tile.M7, Tile.M8, Tile.M9,
        Tile.S1, Tile.S2, Tile.S3,
        Tile.East, Tile.East,
      ],
      open_part: [],
      options: {
        first_take: true,
        riichi: true,
        last_tile: true,
        bakaze: Tile.South,
        jikaze: Tile.East,
      },
    })
    expect(r.is_agari).toBe(true)
    expect(r.yakuman).toBe(1)
    expect(r.yaku[Yaku.Tenhou]).toBe(13)
  })

  it('天和 + 四暗刻単騎 (allow_double_yakuman) -> 3倍役満として複合する', () => {
    // 111m 222m 333m 444m 55p (単騎待ち5p) の四暗刻単騎
    const r = calc({
      closed_part: [
        Tile.M1, Tile.M1, Tile.M1,
        Tile.M2, Tile.M2, Tile.M2,
        Tile.M3, Tile.M3, Tile.M3,
        Tile.M4, Tile.M4, Tile.M4,
        Tile.P5, Tile.P5,
      ],
      open_part: [],
      options: {
        first_take: true,
        bakaze: Tile.South,
        jikaze: Tile.East,
        allow_double_yakuman: true,
      },
    })
    expect(r.is_agari).toBe(true)
    expect(r.yakuman).toBe(3) // 四暗刻単騎(ダブル役満=2) + 天和(1)
    expect(r.yaku[Yaku.SuuankouTanki]).toBe(26)
    expect(r.yaku[Yaku.Tenhou]).toBe(13)
  })

  it('天和 + 純正九蓮宝燈 (allow_double_yakuman) -> 3倍役満として複合する', () => {
    const r = calc({
      closed_part: [
        Tile.P1, Tile.P1, Tile.P1,
        Tile.P2, Tile.P3, Tile.P4, Tile.P5, Tile.P6, Tile.P7, Tile.P8,
        Tile.P9, Tile.P9, Tile.P9, Tile.P9,
      ],
      open_part: [],
      options: {
        first_take: true,
        bakaze: Tile.South,
        jikaze: Tile.East,
        allow_double_yakuman: true,
      },
    })
    expect(r.is_agari).toBe(true)
    expect(r.yakuman).toBe(3) // 純正九蓮宝燈(ダブル役満=2) + 天和(1)
    expect(r.yaku[Yaku.Chuurenpoto9Sides]).toBe(26)
    expect(r.yaku[Yaku.Tenhou]).toBe(13)
  })
})
