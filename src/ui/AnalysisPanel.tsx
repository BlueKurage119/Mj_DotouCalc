import type { DiscardsOutcome, WaitsOutcome } from '../core/analysis'
import type { TileId } from '../core/tiles'
import { TileImage } from './TileImage'

function ScoreCell({ label, total, rank }: { label: string; total?: number; rank?: string }) {
  return (
    <span className="wait-score-col">
      <span className="score-label">{label}</span>
      <span className="score-value">
        {total === undefined ? (
          <em className="noyaku">役なし</em>
        ) : (
          <>
            <strong>{total.toLocaleString()}</strong>
            {rank && <em className="rank">{rank}</em>}
          </>
        )}
      </span>
    </span>
  )
}

/** 聴牌時: 待ち牌一覧とロン・ツモ点数 */
export function WaitsPanel({
  outcome,
  onPickWait,
}: {
  outcome: WaitsOutcome
  onPickWait: (tile: TileId) => void
}) {
  if (!outcome.ok) {
    return (
      <section className="result error">
        <p>{outcome.error}</p>
      </section>
    )
  }
  if (!outcome.tenpai) {
    return (
      <section className="result waiting">
        <p>聴牌していません（万能牌込みで判定）</p>
      </section>
    )
  }
  return (
    <section className="result">
      <div className="analysis-card">
        <div className="analysis-title">
          聴牌 — 待ち {outcome.waits.length}種{' '}
          <span className="hint">タップで和了牌にセット</span>
        </div>
        <ul className="wait-list">
          {outcome.waits.map((w) => (
            <li key={w.tile}>
              <button className="wait-row wait-columns" onClick={() => onPickWait(w.tile)}>
                <span className="wait-tile">
                  <TileImage tile={{ t: w.tile }} />
                </span>
                <span className="wait-left">残{w.remaining}枚</span>
                <ScoreCell label="ロン" total={w.ron?.payment.total} rank={w.ron?.payment.rank} />
                <ScoreCell
                  label="ツモ"
                  total={w.tsumo?.payment.total}
                  rank={w.tsumo?.payment.rank}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** ツモ番 (13枚): 聴牌を保つ打牌候補 */
export function DiscardsPanel({
  outcome,
  showBanner = true,
  onDiscard,
}: {
  outcome: DiscardsOutcome
  showBanner?: boolean
  onDiscard: (tile: TileId) => void
}) {
  if (!outcome.ok) {
    return (
      <section className="result error">
        <p>{outcome.error}</p>
      </section>
    )
  }
  return (
    <section className="result">
      {showBanner && outcome.tsumoWinPossible && (
        <div className="analysis-banner">この手は万能牌の解釈により既にツモ和了できます</div>
      )}
      <div className="analysis-card">
        <div className="analysis-title">
          聴牌になる打牌候補{' '}
          <span className="hint">タップでその牌を切る</span>
        </div>
        {outcome.discards.length === 0 ? (
          <p className="analysis-empty">どの牌を切っても聴牌になりません</p>
        ) : (
          <ul className="wait-list">
            {outcome.discards.map((d) => (
              <li key={d.tile}>
                <button className="wait-row" onClick={() => onDiscard(d.tile)}>
                  <span className="wait-tile">
                    <TileImage tile={{ t: d.tile }} />
                  </span>
                  <span className="discard-arrow">切→</span>
                  <span className="discard-waits">
                    {d.waits.map((w) => (
                      <TileImage key={w} tile={{ t: w }} />
                    ))}
                  </span>
                  <span className="wait-left">{d.waits.length}種{d.totalRemaining}枚</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
