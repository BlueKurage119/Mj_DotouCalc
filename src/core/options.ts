// ルール設定 (揺れをトグル化) とプリセット

export interface RuleOptions {
  /** 支払い方式: 怒涛の戦は親なし */
  payment: 'no-dealer' | 'standard'
  /** 場風役 (役牌:場風) を有効にするか */
  roundWindYaku: boolean
  /** 万能牌がドラ相当牌になった場合にドラとして数えるか */
  almightyDora: 'none' | 'counted'
  /** 高目判定から裏ドラを除外するか (確定後の点数には裏ドラを加算) */
  rankingExcludesUra: boolean
  /** 高目判定からドラを全て除外するか */
  rankingExcludesDora: boolean
  /** 喰いタン */
  kuitan: boolean
  /** 切り上げ満貫 (両ルールともなし) */
  kiriage: boolean
  /** ダブル役満 */
  doubleYakuman: boolean
}

export type PresetId = 'dotou' | 'shura'

export const PRESETS: Record<PresetId, { label: string; options: RuleOptions }> = {
  dotou: {
    label: '怒涛の戦',
    options: {
      payment: 'no-dealer',
      roundWindYaku: false,
      almightyDora: 'none', // 万能牌はドラとして扱われない
      rankingExcludesUra: false,
      rankingExcludesDora: false,
      kuitan: true,
      kiriage: false,
      doubleYakuman: true,
    },
  },
  shura: {
    label: '万象修羅',
    options: {
      payment: 'standard',
      roundWindYaku: true,
      almightyDora: 'counted', // 万能牌がドラ扱いなら+1翻
      rankingExcludesUra: true, // 高目判定は裏ドラを除いて行う
      rankingExcludesDora: false,
      kuitan: true,
      kiriage: false,
      doubleYakuman: true,
    },
  },
}
