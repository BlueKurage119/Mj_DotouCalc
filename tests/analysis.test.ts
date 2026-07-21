import { describe, expect, it } from 'vitest'
import { calcAlmighty } from '../src/core/almighty'
import { analyzeDiscards, analyzeWaits, type AnalysisInput } from '../src/core/analysis'
import { PRESETS } from '../src/core/options'
import { ALL_TILES, EAST, SOUTH, type TileInstance } from '../src/core/tiles'

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

const baseInput: Omit<AnalysisInput, 'concealed'> = {
  melds: [],
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

describe('聴牌分析 (analyzeWaits)', () => {
  it('中バック形: 待ちは 5s と 中', () => {
    const out = analyzeWaits(
      { ...baseInput, concealed: t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中') },
      dotou,
    )
    expect(out.ok).toBe(true)
    expect(out.tenpai).toBe(true)
    // 万能牌が5s周りの順子も作れるため待ちは 3s-7s + 中 に広がる
    expect(out.waits.map((w) => w.tile)).toEqual([21, 22, 23, 24, 25, 34])
    const w5s = out.waits.find((w) => w.tile === 23)!
    expect(w5s.ron?.yaku[52]).toBe(1) // 役牌 中
    expect(w5s.remaining).toBe(3) // 手牌に1枚
    expect(w5s.tsumo?.payment.detail).toContain('オール')
  })

  it('国士12種+万能牌: 13種すべてが待ち', () => {
    const out = analyzeWaits(
      { ...baseInput, concealed: t('1m 9m 1p 9p 1s 9s 東 南 西 北 白 發') },
      dotou,
    )
    expect(out.tenpai).toBe(true)
    expect(out.waits.length).toBe(13)
    expect(out.waits.every((w) => (w.ron?.yakuman ?? 0) >= 1)).toBe(true)
  })

  it('七対子形の待ち', () => {
    // 11m 22m 33p 44p 55s 6s + 万能牌(=6s相当) → 待ちは残りの対子候補
    const out = analyzeWaits(
      { ...baseInput, concealed: t('1m 1m 2m 2m 3p 3p 4p 4p 5s 5s 6s 9s') },
      dotou,
    )
    expect(out.tenpai).toBe(true)
    // 万能牌が6s or 9s になり、もう片方が単騎待ちになる
    expect(out.waits.map((w) => w.tile)).toContain(24) // 6s
    expect(out.waits.map((w) => w.tile)).toContain(27) // 9s
  })

  it('形式聴牌: ロンは役なし・ツモは門前清自摸和', () => {
    const out = analyzeWaits(
      { ...baseInput, concealed: t('2m 3m 4m 6m 7m 8m 2p 3p 4p 1s 2s 9s') },
      dotou,
    )
    expect(out.tenpai).toBe(true)
    const w3s = out.waits.find((w) => w.tile === 21) // 3s (123s + 99s... 9s単騎側もあるが3s確認)
    expect(w3s).toBeDefined()
    expect(w3s!.ron).toBeNull() // 役なし
    expect(w3s!.tsumo?.yaku[35]).toBe(1) // 門前清自摸和
    expect(w3s!.noYaku).toBe(false) // ツモなら役があるので形式聴牌ではない
  })

  it('ノーテンなら tenpai=false', () => {
    const out = analyzeWaits(
      { ...baseInput, concealed: t('1m 4m 7m 2p 5p 8p 3s 6s 9s 東 南 西') },
      dotou,
    )
    expect(out.ok).toBe(true)
    expect(out.tenpai).toBe(false)
  })

  it('hairi由来の待ちが総当たり判定と一致する', () => {
    const hands = [
      '2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中',
      '1m 1m 2m 2m 3p 3p 4p 4p 5s 5s 6s 9s',
      '2m 3m 4m 6m 7m 8m 2p 3p 4p 1s 2s 9s',
    ]
    for (const hand of hands) {
      const input = { ...baseInput, concealed: t(hand) }
      const viaHairi = analyzeWaits(input, dotou).waits.map((w) => w.tile)
      const brute: number[] = []
      for (const w of ALL_TILES) {
        const r = calcAlmighty({ ...input, winTile: { t: w }, isTsumo: false, firstTake: false }, dotou)
        if (r.ok || r.hadNoYaku) brute.push(w)
      }
      expect(viaHairi).toEqual(brute)
    }
  })

  it('5枚使いの待ち牌除外の検証 (Issue 9)', () => {
    const out = analyzeWaits(
      {
        ...baseInput,
        melds: [
          { type: 'pon', tiles: t('6p 6p 6p') },
          { type: 'minkan', tiles: t('8p 8p 8p 8p') },
        ],
        concealed: t('2p 2p 2p 4p 4p 4p'),
      },
      dotou,
    )
    // Issue #9 の 222444p + ポン666p + 明槓8888p ケースで 8p が不可、2p/4p/6p は別置換で和了可能です。
    const waits = out.waits.map((w) => w.tile)
    expect(out.tenpai).toBe(true)
    expect(waits).not.toContain(17) // 8p
    expect(waits).toEqual(ALL_TILES.filter((tile) => tile !== 17))
    expect(waits).toEqual(expect.arrayContaining([11, 13, 15])) // 2p, 4p, 6p
  })
})

describe('何切る分析 (analyzeDiscards)', () => {
  it('13枚: 不要牌を切ると聴牌', () => {
    const out = analyzeDiscards(
      {
        ...baseInput,
        concealed: t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中 9p'),
      },
      dotou,
    )
    expect(out.ok).toBe(true)
    const d9p = out.discards.find((d) => d.tile === 18) // 9p
    expect(d9p).toBeDefined()
    expect(d9p!.waits).toContain(23) // 5s
    expect(d9p!.waits).toContain(34) // 中
  })

  it('万能牌の解釈で既に和了形ならツモ和了可能と判定', () => {
    const out = analyzeDiscards(
      {
        ...baseInput,
        concealed: t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 5s 中 中'),
      },
      dotou,
    )
    expect(out.ok).toBe(true)
    expect(out.tsumoWinPossible).toBe(true)
  })

  it('打牌候補は実牌のみ (万能牌は切れない)', () => {
    const out = analyzeDiscards(
      {
        ...baseInput,
        concealed: t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中 9p'),
      },
      dotou,
    )
    const handIds = new Set(t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中 9p').map((x) => x.t))
    expect(out.discards.every((d) => handIds.has(d.tile))).toBe(true)
  })

  it('枚数不正はエラー', () => {
    const out = analyzeDiscards({ ...baseInput, concealed: t('1m 2m 3m') }, dotou)
    expect(out.ok).toBe(false)
    expect(out.error).toContain('13枚')
  })

  it('点数レンジは待ちごとのロン/ツモ計算の最小〜最大と一致する', () => {
    const out = analyzeDiscards(
      {
        ...baseInput,
        concealed: t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中 9p'),
      },
      dotou,
    )
    const d9p = out.discards.find((d) => d.tile === 18)! // 9p切り
    const waitsOut = analyzeWaits(
      { ...baseInput, concealed: t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中') },
      dotou,
    )
    const totals: number[] = []
    let hasNoYakuWait = false
    for (const w of waitsOut.waits) {
      if (w.ron) totals.push(w.ron.payment.total)
      if (w.tsumo) totals.push(w.tsumo.payment.total)
      if (w.noYaku) hasNoYakuWait = true
    }
    expect(d9p.hasNoYakuWait).toBe(hasNoYakuWait)
    expect(d9p.scoreRange).toEqual({ min: Math.min(...totals), max: Math.max(...totals) })
  })

  it('副露あり手: 全ての待ちが役なしならレンジはnull', () => {
    // 999p(ポン)は役牌でも断幺九対象でもないため、234m+678m+234sが確定していても
    // 待ちは常に役なし (門前ツモ不可・幺九牌で断幺九不可・他の役の成立条件も満たさない)
    const out = analyzeDiscards(
      {
        ...baseInput,
        melds: [{ type: 'pon', tiles: t('9p 9p 9p') }],
        concealed: t('2m 3m 4m 6m 7m 8m 2s 3s 4s 9s'),
      },
      dotou,
    )
    expect(out.ok).toBe(true)
    const d9s = out.discards.find((d) => d.tile === 27)! // 9s切り
    expect(d9s).toBeDefined()
    expect(d9s.scoreRange).toBeNull()
    expect(d9s.hasNoYakuWait).toBe(true)
  })

  it('副露あり手: 一部の待ちのみ役ありなら hasNoYakuWait と scoreRange が両立する', () => {
    // 999p(ポン) + 234m + 678m + 5s + 中中 + 9s(切り)。
    // 中待ちは役牌(中)成立、5s待ちも中中中+5s5sの高目解釈で役牌成立するが、
    // 3s/4s/6s/7s待ちは順子+中中(対子のまま)しか成立せず役なしになる
    const out = analyzeDiscards(
      {
        ...baseInput,
        melds: [{ type: 'pon', tiles: t('9p 9p 9p') }],
        concealed: t('2m 3m 4m 6m 7m 8m 5s 中 中 9s'),
      },
      dotou,
    )
    const d9s = out.discards.find((d) => d.tile === 27)! // 9s切り
    expect(d9s).toBeDefined()
    expect(d9s.hasNoYakuWait).toBe(true)
    expect(d9s.scoreRange).not.toBeNull()
  })

  it('振聴: シャンポン待ちの一方を切ると、その牌自身が待ちに含まれる (2p切り2p待ち相当)', () => {
    // 副露3組(2m2m2m, 5p5p5p, 8p8p8p) + 1s1s9s9s のシャンポン形。
    // 1sを切ると残りは1s9s9sとなり、万能牌で1s9s9sの1sを補って1s1s+9s9sのシャンポンに戻るため、
    // 切った1s自身が待ちに含まれる (9sを切った場合も同様)。
    const out = analyzeDiscards(
      {
        ...baseInput,
        melds: [
          { type: 'pon', tiles: t('2m 2m 2m') },
          { type: 'pon', tiles: t('5p 5p 5p') },
          { type: 'pon', tiles: t('8p 8p 8p') },
        ],
        concealed: t('1s 1s 9s 9s'),
      },
      dotou,
    )
    expect(out.ok).toBe(true)
    const d1s = out.discards.find((d) => d.tile === 19)! // 1s切り
    expect(d1s).toBeDefined()
    expect(d1s.waits).toContain(20) // 2s
    expect(d1s.furiten).toBe(true)
    // 切った1s自身も待ち牌一覧に表示され、枚数集計にも含まれる
    // (1s: 手牌2枚使用で残2枚 + 2s: 手牌0枚で残4枚 + 万能牌経由の他の待ち)
    expect(d1s.waits).toContain(19)
    const remaining1s = 2 // 4 - 手牌の1s2枚 (切った1枚は河、残り1枚は手中)
    expect(d1s.totalRemaining).toBeGreaterThanOrEqual(remaining1s)
    const d9s = out.discards.find((d) => d.tile === 27)! // 9s切り
    expect(d9s).toBeDefined()
    expect(d9s.furiten).toBe(true)
    expect(d9s.waits).toContain(27)
  })

  it('振聴ではない通常の打牌候補は furiten=false', () => {
    const out = analyzeDiscards(
      {
        ...baseInput,
        concealed: t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中 9p'),
      },
      dotou,
    )
    expect(out.discards.every((d) => d.furiten === false)).toBe(true)
  })

  it('firstTake が入力に紛れ込んでも結果に影響しない (#16 天和・地和は分析対象外)', () => {
    const hand = t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中 9p')
    const without = analyzeDiscards({ ...baseInput, concealed: hand }, dotou)
    // AnalysisInput 型は firstTake を除外しているが、万一 baseInput 経由で紛れ込んでも
    // analyzeDiscards 内部は常に firstTake: false を明示して calcAlmighty を呼ぶため無視される。
    const withLeak = analyzeDiscards(
      { ...baseInput, concealed: hand, firstTake: true } as unknown as AnalysisInput,
      dotou,
    )
    expect(withLeak).toEqual(without)
  })

  it('立直・裏ドラの条件設定がレンジ計算に反映される', () => {
    const hand = t('2m 3m 4m 5m 6m 7m 2p 3p 4p 5s 中 中 9p')
    const without = analyzeDiscards({ ...baseInput, concealed: hand }, dotou)
    const withRiichi = analyzeDiscards(
      { ...baseInput, concealed: hand, riichi: true, uraIndicators: t('5m') },
      dotou,
    )
    const d1 = without.discards.find((d) => d.tile === 18)!.scoreRange!
    const d2 = withRiichi.discards.find((d) => d.tile === 18)!.scoreRange!
    expect(d2.max).toBeGreaterThan(d1.max)
  })
})
