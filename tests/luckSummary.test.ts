import { describe, expect, it } from 'vitest'
import { luckSummary, type LuckState } from '../src/ui/LuckSheet'

const base: LuckState = {
  riichiState: 'none',
  ippatsu: false,
  rinshan: false,
  chankan: false,
  lastTile: false,
  koPayers: 3,
  dealerPays: true,
}

describe('luckSummary', () => {
  it('怒涛の戦 (isStandard=false) はツモ払いを表示しない', () => {
    expect(luckSummary(base)).toBe('なし')
    expect(luckSummary({ ...base, riichiState: 'riichi', ippatsu: true })).toBe('立直・一発')
  })
  it('万象修羅・親: 人数のみ', () => {
    expect(luckSummary({ ...base, koPayers: 3 }, true, true)).toBe('ツモ払い3人')
    expect(luckSummary({ ...base, koPayers: 1 }, true, true)).toBe('ツモ払い1人')
  })
  it('万象修羅・子: 親+子/親のみ/子のみを出し分け', () => {
    expect(luckSummary({ ...base, koPayers: 2 }, true, false)).toBe('ツモ払い 親+子2人')
    expect(luckSummary({ ...base, koPayers: 0 }, true, false)).toBe('ツモ払い 親のみ')
    expect(luckSummary({ ...base, koPayers: 2, dealerPays: false }, true, false)).toBe('ツモ払い 子2人')
    expect(luckSummary({ ...base, koPayers: 1, dealerPays: false }, true, false)).toBe('ツモ払い 子1人')
  })
  it('偶然役と連結される', () => {
    expect(luckSummary({ ...base, riichiState: 'riichi', koPayers: 2 }, true, false)).toBe(
      '立直・ツモ払い 親+子2人',
    )
  })
})
