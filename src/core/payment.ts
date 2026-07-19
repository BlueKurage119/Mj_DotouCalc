// 翻・符 → 基本点 → 支払い額。
// 「怒涛の戦」は親が存在しないため通常の点数表が使えず、自前で計算する。

export interface PaymentInput {
  han: number
  fu: number
  /** 役満の個数 (0 なら通常手) */
  yakuman: number
  isTsumo: boolean
  /** 'no-dealer': 怒涛の戦方式(親なし、全員子) / 'standard': 通常方式 */
  mode: 'no-dealer' | 'standard'
  /** standard のみ: 自分が親か */
  isDealer: boolean
  /** ツモ時に支払う子の人数 (和了済/飛びは支払わない。通常は3、standardで親が別枠なら子の数) */
  koPayers: number
  /** standard・自分が子のツモ時、親が支払うか (親が和了済なら false = ツモ損) */
  dealerPays: boolean
  kiriage: boolean
}

export interface Payment {
  /** 受け取り合計 */
  total: number
  /** 支払い内訳の表示用文字列 (例: "2000オール" / "3900・2000") */
  detail: string
  /** 満貫等のラベル。通常手は '' */
  rank: string
  base: number
}

const ceil100 = (x: number) => Math.ceil(x / 100) * 100

/** 基本点とランク名 */
export function basePoints(han: number, fu: number, yakuman: number, kiriage: boolean): { base: number; rank: string } {
  if (yakuman > 0) {
    return { base: 8000 * yakuman, rank: yakuman > 1 ? `${yakuman}倍役満` : '役満' }
  }
  if (han >= 13) return { base: 8000, rank: '数え役満' }
  if (han >= 11) return { base: 6000, rank: '三倍満' }
  if (han >= 8) return { base: 4000, rank: '倍満' }
  if (han >= 6) return { base: 3000, rank: '跳満' }
  const raw = fu * Math.pow(2, 2 + han)
  if (han >= 5 || raw > 2000) return { base: 2000, rank: '満貫' }
  if (kiriage && ((han === 4 && fu === 30) || (han === 3 && fu === 60))) {
    return { base: 2000, rank: '満貫' }
  }
  return { base: raw, rank: '' }
}

export function calcPayment(p: PaymentInput): Payment {
  const { base, rank } = basePoints(p.han, p.fu, p.yakuman, p.kiriage)
  if (p.mode === 'no-dealer') {
    // 怒涛の戦: 親なし。ロンは子ロン相当、ツモは他家全員が子として支払い
    if (p.isTsumo) {
      const each = ceil100(base)
      return { total: each * p.koPayers, detail: `${each}オール (${p.koPayers}人払い)`, rank, base }
    }
    const total = ceil100(base * 4)
    return { total, detail: `ロン ${total}`, rank, base }
  }
  // standard
  if (p.isDealer) {
    if (p.isTsumo) {
      const each = ceil100(base * 2)
      return { total: each * p.koPayers, detail: `${each}オール (${p.koPayers}人払い)`, rank, base }
    }
    const total = ceil100(base * 6)
    return { total, detail: `ロン ${total}`, rank, base }
  }
  if (p.isTsumo) {
    const koEach = ceil100(base)
    const oya = p.dealerPays ? ceil100(base * 2) : 0
    const total = koEach * p.koPayers + oya
    const detail = p.dealerPays
      ? `子${koEach}・親${oya} (子${p.koPayers}人)`
      : `子${koEach}×${p.koPayers} (親は支払いなし)`
    return { total, detail, rank, base }
  }
  const total = ceil100(base * 4)
  return { total, detail: `ロン ${total}`, rank, base }
}
