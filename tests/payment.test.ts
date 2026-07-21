import { describe, expect, it } from 'vitest'
import { basePoints, calcPayment, nextTierHint } from '../src/core/payment'

const base = {
  yakuman: 0,
  isTsumo: false,
  isDealer: false,
  koPayers: 3,
  dealerPays: true,
  kiriage: false,
}

describe('basePoints', () => {
  it('通常手', () => {
    expect(basePoints(1, 40, 0, false).base).toBe(320)
    expect(basePoints(4, 30, 0, false)).toEqual({ base: 1920, rank: '' }) // 切り上げ満貫なし
    expect(basePoints(4, 40, 0, false)).toEqual({ base: 2000, rank: '満貫' })
    expect(basePoints(5, 30, 0, false)).toEqual({ base: 2000, rank: '満貫' })
    expect(basePoints(6, 30, 0, false)).toEqual({ base: 3000, rank: '跳満' })
    expect(basePoints(8, 30, 0, false)).toEqual({ base: 4000, rank: '倍満' })
    expect(basePoints(11, 30, 0, false)).toEqual({ base: 6000, rank: '三倍満' })
    expect(basePoints(13, 30, 0, false)).toEqual({ base: 8000, rank: '数え役満' })
  })
  it('切り上げ満貫ありなら30符4翻は満貫', () => {
    expect(basePoints(4, 30, 0, true)).toEqual({ base: 2000, rank: '満貫' })
  })
  it('役満', () => {
    expect(basePoints(0, 0, 1, false)).toEqual({ base: 8000, rank: '役満' })
    expect(basePoints(0, 0, 2, false)).toEqual({ base: 16000, rank: '2倍役満' })
  })
})

describe('nextTierHint (＋N飜で◯◯)', () => {
  it('満貫未満は満貫までの飜数', () => {
    expect(nextTierHint(3, 30, 0, false)).toBe('＋2飜で満貫') // 4翻30符=7700なので+2で満貫
    expect(nextTierHint(3, 40, 0, false)).toBe('＋1飜で満貫') // 4翻40符=満貫
    expect(nextTierHint(1, 40, 0, false)).toBe('＋3飜で満貫')
  })
  it('満貫以上は次の点数帯まで', () => {
    expect(nextTierHint(5, 30, 0, false)).toBe('＋1飜で跳満')
    expect(nextTierHint(6, 30, 0, false)).toBe('＋2飜で倍満')
    expect(nextTierHint(8, 30, 0, false)).toBe('＋3飜で三倍満')
    expect(nextTierHint(11, 30, 0, false)).toBe('＋2飜で数え役満')
  })
  it('役満・数え役満はヒントなし', () => {
    expect(nextTierHint(13, 30, 0, false)).toBeNull()
    expect(nextTierHint(0, 0, 1, false)).toBeNull()
  })
  it('切り上げ満貫ありなら30符3翻は+1飜で満貫', () => {
    expect(nextTierHint(3, 30, 0, true)).toBe('＋1飜で満貫')
  })
})

describe('怒涛の戦方式 (親なし)', () => {
  it('子ロン相当: 満貫ロン 8000', () => {
    const p = calcPayment({ ...base, han: 5, fu: 30, mode: 'no-dealer' })
    expect(p.total).toBe(8000)
    expect(p.rank).toBe('満貫')
  })
  it('30符4翻ロンは7700 (切り上げなし)', () => {
    expect(calcPayment({ ...base, han: 4, fu: 30, mode: 'no-dealer' }).total).toBe(7700)
  })
  it('ツモは他家全員が子払い: 満貫ツモ 2000×3=6000', () => {
    const p = calcPayment({ ...base, han: 5, fu: 30, isTsumo: true, mode: 'no-dealer' })
    expect(p.total).toBe(6000)
    expect(p.detail).toContain('2000オール')
  })
  it('飛び等で支払いが2人なら 2000×2=4000', () => {
    const p = calcPayment({ ...base, han: 5, fu: 30, isTsumo: true, mode: 'no-dealer', koPayers: 2 })
    expect(p.total).toBe(4000)
  })
  it('40符1翻ツモ: 400×3', () => {
    const p = calcPayment({ ...base, han: 1, fu: 40, isTsumo: true, mode: 'no-dealer' })
    expect(p.total).toBe(1200)
  })
  it('役満ロン 32000', () => {
    const p = calcPayment({ ...base, han: 0, fu: 0, yakuman: 1, mode: 'no-dealer' })
    expect(p.total).toBe(32000)
  })
})

describe('通常方式', () => {
  it('親ロン 満貫 12000', () => {
    expect(calcPayment({ ...base, han: 5, fu: 30, mode: 'standard', isDealer: true }).total).toBe(12000)
  })
  it('親ツモ 満貫 4000オール', () => {
    const p = calcPayment({ ...base, han: 5, fu: 30, isTsumo: true, mode: 'standard', isDealer: true })
    expect(p.total).toBe(12000)
    expect(p.detail).toContain('4000オール')
  })
  it('子ツモ 満貫 2000・4000 (子2人+親)', () => {
    const p = calcPayment({ ...base, han: 5, fu: 30, isTsumo: true, mode: 'standard', koPayers: 2 })
    expect(p.total).toBe(8000)
    expect(p.detail).not.toContain('オール')
  })
  it('子ツモ 満貫 支払者が親のみ: 4000', () => {
    const p = calcPayment({
      ...base,
      han: 5,
      fu: 30,
      isTsumo: true,
      mode: 'standard',
      koPayers: 0,
      dealerPays: true,
    })
    expect(p.total).toBe(4000)
    expect(p.detail).toContain('親4000')
    expect(p.detail).not.toContain('オール')
  })
  it('ツモ損: 親が和了済なら親の支払いなし (子複数はオール表記)', () => {
    const p = calcPayment({
      ...base,
      han: 5,
      fu: 30,
      isTsumo: true,
      mode: 'standard',
      koPayers: 2,
      dealerPays: false,
    })
    expect(p.total).toBe(4000)
    expect(p.detail).toContain('2000オール')
  })
  it('ツモ損: 子1人のみなら「オール」を付けない', () => {
    const p = calcPayment({
      ...base,
      han: 5,
      fu: 30,
      isTsumo: true,
      mode: 'standard',
      koPayers: 1,
      dealerPays: false,
    })
    expect(p.total).toBe(2000)
    expect(p.detail).not.toContain('オール')
  })
  it('親ツモ 満貫 子2人でもオール表記 (境界値)', () => {
    const p = calcPayment({
      ...base,
      han: 5,
      fu: 30,
      isTsumo: true,
      mode: 'standard',
      isDealer: true,
      koPayers: 2,
    })
    expect(p.total).toBe(8000)
    expect(p.detail).toContain('4000オール')
  })
  it('親ツモ 満貫 子1人のみなら「オール」を付けない', () => {
    const p = calcPayment({
      ...base,
      han: 5,
      fu: 30,
      isTsumo: true,
      mode: 'standard',
      isDealer: true,
      koPayers: 1,
    })
    expect(p.total).toBe(4000)
    expect(p.detail).toContain('4000')
    expect(p.detail).not.toContain('オール')
  })
  it('子ロン 40符1翻 1300', () => {
    expect(calcPayment({ ...base, han: 1, fu: 40, mode: 'standard' }).total).toBe(1300)
  })
})
