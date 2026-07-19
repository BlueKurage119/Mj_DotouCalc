// 詳細設定ページ (ルールの揺れトグル)
import type { RuleOptions } from '../core/options'

export function SettingsView({
  options,
  toggle,
  presetLabel,
  onReset,
  onBack,
}: {
  options: RuleOptions
  toggle: <K extends keyof RuleOptions>(key: K, value: RuleOptions[K]) => void
  presetLabel: string
  onReset: () => void
  onBack: () => void
}) {
  return (
    <div className="settings-view">
      <header className="appbar">
        <button className="text-btn" onClick={onBack}>
          ← 戻る
        </button>
        <span className="appbar-title">詳細設定</span>
        <button className="text-btn" onClick={onReset}>
          {presetLabel}に戻す
        </button>
      </header>
      <div className="settings-list">
        <label className="setting-item">
          <span>支払い方式</span>
          <select
            value={options.payment}
            onChange={(e) => toggle('payment', e.target.value as RuleOptions['payment'])}
          >
            <option value="no-dealer">親なし (怒涛方式)</option>
            <option value="standard">通常 (親あり)</option>
          </select>
        </label>
        {(
          [
            ['roundWindYaku', '役牌: 場風'],
            ['rankingExcludesUra', '高目判定から裏ドラを除外'],
            ['rankingExcludesDora', '高目判定からドラを全て除外'],
            ['kuitan', '喰いタン'],
            ['kiriage', '切り上げ満貫'],
            ['doubleYakuman', 'ダブル役満'],
          ] as [keyof RuleOptions, string][]
        ).map(([key, label]) => (
          <label className="setting-item" key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={options[key] as boolean}
              onChange={(e) => toggle(key, e.target.checked as RuleOptions[typeof key])}
            />
          </label>
        ))}
        <label className="setting-item">
          <span>万能牌をドラとして数える</span>
          <input
            type="checkbox"
            checked={options.almightyDora === 'counted'}
            onChange={(e) => toggle('almightyDora', e.target.checked ? 'counted' : 'none')}
          />
        </label>
      </div>
      <p className="settings-note">
        プリセットを切り替えると設定はプリセットの既定値に戻ります
      </p>
    </div>
  )
}
