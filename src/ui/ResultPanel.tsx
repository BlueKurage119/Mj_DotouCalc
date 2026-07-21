import { useState } from 'react'
import type { CalcOutcome, Candidate } from '../core/almighty'
import { nextTierHint } from '../core/payment'
import type { TileInstance } from '../core/tiles'
import { YAKU_NAMES } from '../core/yakuNames'
import { IconClose } from './icons'
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

/** ツモの点数申告 (例: 700オール / 子700・親1300) から「子」「親」の見出しを外し、数値をカンマ区切りにする */
function formatTsumoAnnounce(detail: string): string {
  return detail
    .replace(/\s*\(.*\)$/, '')
    .replace(/[子親]/g, '')
    .replace(/\d+/g, (m) => Number(m).toLocaleString())
}

function CandidateCard({
  c,
  side,
  winTile,
  best,
  kiriage,
}: {
  c: Candidate
  side: 'ツモ' | 'ロン'
  winTile: TileInstance
  best?: boolean
  kiriage: boolean
}) {
  const hint = best ? nextTierHint(c.han, c.fu, c.yakuman, kiriage) : null
  const isYakuman = c.yakuman > 0
  return (
    <div className={`candidate${best ? ' best' : ''}`}>
      <div className="candidate-head">
        <span className="interp">
          <span className="side-badge">{side}</span>
          <TileImage tile={winTile} />
          <span className="almighty-tile">
            <TileImage tile={{ t: c.tile }} />
          </span>
        </span>
        <span className="score">
          <strong>
            {side === 'ツモ'
              ? formatTsumoAnnounce(c.payment.detail)
              : c.payment.total.toLocaleString()}
          </strong>
        </span>
      </div>
      <div className="candidate-sub">
        {isYakuman ? (
          <em className="rank yakuman-rank">{c.payment.rank}</em>
        ) : (
          <span>
            {c.han}翻{c.fu > 0 ? ` ${c.fu}符` : ''}
            {c.payment.rank && <em className="rank">{c.payment.rank}</em>}
          </span>
        )}
        {side === 'ツモ' && (
          <span className="pay-detail">合計 {c.payment.total.toLocaleString()}点</span>
        )}
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
  winTile,
  kiriage,
}: {
  outcome: CalcOutcome
  side: 'ツモ' | 'ロン'
  winTile: TileInstance
  kiriage: boolean
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
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
      <CandidateCard c={outcome.best} side={side} winTile={winTile} best kiriage={kiriage} />
      {rest.length > 0 && (
        <>
          <button className="others-toggle" onClick={() => setSheetOpen(true)}>
            {side}の他の解釈 {rest.length}件
          </button>
          {sheetOpen && (
            <div className="sheet-overlay" onClick={() => setSheetOpen(false)}>
              <div className="sheet" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-title">
                  <span>{side}の他の解釈</span>
                  <button
                    className="sheet-close"
                    aria-label="閉じる"
                    onClick={() => setSheetOpen(false)}
                  >
                    <IconClose />
                  </button>
                </div>
                <div className="others sheet-scroll">
                  {rest.map((c) => (
                    <CandidateCard key={c.tile} c={c} side={side} winTile={winTile} kiriage={kiriage} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

/** ツモ・ロン両方の結果を並べて表示 */
export function ResultPanel({
  tsumo,
  ron,
  winTile,
  kiriage,
}: {
  tsumo: CalcOutcome
  ron: CalcOutcome
  winTile: TileInstance
  kiriage: boolean
}) {
  return (
    <section className="result">
      <SideResult outcome={tsumo} side="ツモ" winTile={winTile} kiriage={kiriage} />
      <SideResult outcome={ron} side="ロン" winTile={winTile} kiriage={kiriage} />
    </section>
  )
}
