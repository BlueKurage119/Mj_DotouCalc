// 「立直・偶然役関係」ボトムシート

export interface LuckState {
  isTsumo: boolean
  riichiState: 'none' | 'riichi' | 'double'
  ippatsu: boolean
  afterKan: boolean
  lastTile: boolean
  koPayers: number
  dealerPays: boolean
}

export function luckSummary(s: LuckState, hasOpenMeld: boolean): string {
  const parts: string[] = [s.isTsumo ? 'ツモ' : 'ロン']
  if (s.riichiState === 'riichi') parts.push('立直')
  if (s.riichiState === 'double') parts.push('W立直')
  if (s.riichiState !== 'none' && s.ippatsu) parts.push('一発')
  if (s.afterKan) parts.push(s.isTsumo ? '嶺上' : '搶槓')
  if (s.lastTile) parts.push(s.isTsumo ? '海底' : '河底')
  if (hasOpenMeld && s.riichiState !== 'none') parts.push('(副露中は立直不可)')
  return parts.join('・')
}

export function LuckSheet({
  state,
  patch,
  hasOpenMeld,
  isStandard,
  isDealer,
  onClose,
}: {
  state: LuckState
  patch: (p: Partial<LuckState>) => void
  hasOpenMeld: boolean
  /** 通常(親あり)方式か */
  isStandard: boolean
  isDealer: boolean
  onClose: () => void
}) {
  const riichiOn = state.riichiState !== 'none'
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">
          <span>立直・偶然役</span>
          <button className="text-btn" onClick={onClose}>
            完了
          </button>
        </div>
        <div className="seg-row">
          <span className="seg-label">和了</span>
          <div className="seg">
            <button className={state.isTsumo ? 'on' : ''} onClick={() => patch({ isTsumo: true })}>
              ツモ
            </button>
            <button className={!state.isTsumo ? 'on' : ''} onClick={() => patch({ isTsumo: false })}>
              ロン
            </button>
          </div>
        </div>
        <div className="seg-row">
          <span className="seg-label">立直</span>
          <div className="seg">
            <button
              className={state.riichiState === 'none' ? 'on' : ''}
              onClick={() => patch({ riichiState: 'none', ippatsu: false })}
            >
              なし
            </button>
            <button
              className={state.riichiState === 'riichi' ? 'on' : ''}
              disabled={hasOpenMeld}
              onClick={() => patch({ riichiState: 'riichi' })}
            >
              立直
            </button>
            <button
              className={state.riichiState === 'double' ? 'on' : ''}
              disabled={hasOpenMeld}
              onClick={() => patch({ riichiState: 'double' })}
            >
              W立直
            </button>
          </div>
        </div>
        <div className="seg-row">
          <span className="seg-label">偶然役</span>
          <div className="seg wrap">
            <button
              className={riichiOn && state.ippatsu ? 'on' : ''}
              disabled={!riichiOn}
              onClick={() => patch({ ippatsu: !state.ippatsu })}
            >
              一発
            </button>
            <button
              className={state.afterKan ? 'on' : ''}
              onClick={() => patch({ afterKan: !state.afterKan })}
            >
              {state.isTsumo ? '嶺上開花' : '搶槓'}
            </button>
            <button
              className={state.lastTile ? 'on' : ''}
              onClick={() => patch({ lastTile: !state.lastTile })}
            >
              {state.isTsumo ? '海底' : '河底'}
            </button>
          </div>
        </div>
        {state.isTsumo && (
          <div className="seg-row">
            <span className="seg-label">ツモ払い</span>
            {isStandard && !isDealer ? (
              <div className="seg wrap">
                <button
                  className={state.dealerPays ? 'on' : ''}
                  onClick={() => patch({ dealerPays: !state.dealerPays })}
                >
                  親が払う
                </button>
                {[0, 1, 2].map((n) => (
                  <button
                    key={n}
                    className={state.koPayers === n ? 'on' : ''}
                    onClick={() => patch({ koPayers: n })}
                  >
                    子{n}人
                  </button>
                ))}
              </div>
            ) : (
              <div className="seg">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    className={state.koPayers === n ? 'on' : ''}
                    onClick={() => patch({ koPayers: n })}
                  >
                    {n}人
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="sheet-note">ツモ払いの人数は和了済・飛びの家を除いた支払い相手の数です</p>
      </div>
    </div>
  )
}
