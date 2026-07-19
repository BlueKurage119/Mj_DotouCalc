import { useState } from 'react'
import type { CalcOutcome, Candidate } from '../core/almighty'
import { YAKU_NAMES } from '../core/yakuNames'
import { TileFace } from './TileFace'

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

function CandidateCard({ c, best }: { c: Candidate; best?: boolean }) {
  return (
    <div className={`candidate${best ? ' best' : ''}`}>
      <div className="candidate-head">
        <span className="interp">
          万能牌 = <TileFace tile={{ t: c.tile }} />
        </span>
        <span className="score">
          {c.payment.rank && <em className="rank">{c.payment.rank}</em>}
          <strong>{c.payment.total.toLocaleString()}点</strong>
        </span>
      </div>
      <div className="candidate-sub">
        {c.yakuman > 0 ? `役満×${c.yakuman}` : `${c.han}翻${c.fu > 0 ? ` ${c.fu}符` : ''}`}
        <span className="pay-detail">{c.payment.detail}</span>
      </div>
      <YakuList c={c} />
    </div>
  )
}

export function ResultPanel({
  outcome,
  inputComplete,
}: {
  outcome: CalcOutcome | null
  inputComplete: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  if (!inputComplete || !outcome) {
    return (
      <section className="result waiting">
        <p>手牌と和了牌を入力すると自動で計算します</p>
      </section>
    )
  }
  if (!outcome.ok || !outcome.best) {
    return (
      <section className="result error">
        <p>{outcome.error}</p>
      </section>
    )
  }
  const rest = outcome.candidates.slice(1)
  return (
    <section className="result">
      <CandidateCard c={outcome.best} best />
      {rest.length > 0 && (
        <div className="others">
          <button className="others-toggle" onClick={() => setShowAll(!showAll)}>
            他の解釈 {rest.length}件 {showAll ? '▲' : '▼'}
          </button>
          {showAll && rest.map((c) => <CandidateCard key={c.tile} c={c} />)}
        </div>
      )}
    </section>
  )
}
