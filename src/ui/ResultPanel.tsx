import { useState } from 'react'
import type { CalcOutcome, Candidate } from '../core/almighty'
import { nextTierHint } from '../core/payment'
import { YAKU_NAMES } from '../core/yakuNames'
import { TileImage } from './TileImage'

function YakuList({ c }: { c: Candidate }) {
  const entries = Object.entries(c.yaku)
    .map(([id, han]) => ({ id: Number(id), han }))
    .sort((a, b) => b.han - a.han || a.id - b.id)
  return (
    <ul className="yaku-list">
      {entries.map((y) => (
        <li key={y.id}>
          <span>{YAKU_NAMES[y.id] ?? `役#${y.id}`}</span>
          <span>{c.yakuman > 0 ? '役満' : `${y.han}翻`}</span>
        </li>
      ))}
    </ul>
  )
}

function CandidateCard({
  c,
  side,
  best,
  kiriage,
}: {
  c: Candidate
  side: 'ツモ' | 'ロン'
  best?: boolean
  kiriage: boolean
}) {
  // ツモは点数申告用語 (例: 700オール / 子700・親1300) を主表示にする
  const announce = c.payment.detail.replace(/\s*\(.*\)$/, '')
  const hint = best ? nextTierHint(c.han, c.fu, c.yakuman, kiriage) : null
  return (
    <div className={`candidate${best ? ' best' : ''}`}>
      <div className="candidate-head">
        <span className="interp">
          <span className="side-badge">{side}</span>
          万能牌 = <TileImage tile={{ t: c.tile }} />
        </span>
        <span className="score">
          {c.payment.rank && <em className="rank">{c.payment.rank}</em>}
          <strong>{side === 'ツモ' ? announce : `${c.payment.total.toLocaleString()}点`}</strong>
        </span>
      </div>
      <div className="candidate-sub">
        <span>
          {c.yakuman > 0 ? `役満×${c.yakuman}` : `${c.han}翻${c.fu > 0 ? ` ${c.fu}符` : ''}`}
        </span>
        <span className="pay-detail">合計 {c.payment.total.toLocaleString()}点</span>
      </div>
      {hint && <div className="tier-hint">{hint}</div>}
      <YakuList c={c} />
    </div>
  )
}

/** 片側 (ツモ or ロン) の結果表示 */
function SideResult({
  outcome,
  side,
  kiriage,
}: {
  outcome: CalcOutcome
  side: 'ツモ' | 'ロン'
  kiriage: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  if (!outcome.ok || !outcome.best) {
    return (
      <div className="candidate noyaku-side">
        <div className="candidate-head">
          <span className="interp">
            <span className="side-badge">{side}</span>
          </span>
          <span className="noyaku-text">{outcome.hadNoYaku ? '役なし' : '和了になりません'}</span>
        </div>
      </div>
    )
  }
  const rest = outcome.candidates.slice(1)
  return (
    <>
      <CandidateCard c={outcome.best} side={side} best kiriage={kiriage} />
      {rest.length > 0 && (
        <div className="others">
          <button className="others-toggle" onClick={() => setShowAll(!showAll)}>
            {side}の他の解釈 {rest.length}件 {showAll ? '▲' : '▼'}
          </button>
          {showAll &&
            rest.map((c) => <CandidateCard key={c.tile} c={c} side={side} kiriage={kiriage} />)}
        </div>
      )}
    </>
  )
}

/** ツモ・ロン両方の結果を並べて表示 */
export function ResultPanel({
  tsumo,
  ron,
  kiriage,
}: {
  tsumo: CalcOutcome
  ron: CalcOutcome
  kiriage: boolean
}) {
  return (
    <section className="result">
      <SideResult outcome={tsumo} side="ツモ" kiriage={kiriage} />
      <SideResult outcome={ron} side="ロン" kiriage={kiriage} />
    </section>
  )
}
