// 「立直・偶然役関係」ボトムシート
// ツモ/ロンは切替式ではなく両方計算するため、嶺上開花(ツモ側)と搶槓(ロン側)は独立トグル

export interface LuckState {
  riichiState: 'none' | 'riichi' | 'double'
  ippatsu: boolean
  /** 嶺上開花 (ツモ側の結果にのみ適用) */
  rinshan: boolean
  /** 搶槓 (ロン側の結果にのみ適用) */
  chankan: boolean
  /** 海底(ツモ側)/河底(ロン側) */
  lastTile: boolean
  koPayers: number
  dealerPays: boolean
}

export function luckSummary(s: LuckState): string {
  const parts: string[] = []
  if (s.riichiState === 'riichi') parts.push('立直')
  if (s.riichiState === 'double') parts.push('W立直')
  if (s.riichiState !== 'none' && s.ippatsu) parts.push('一発')
  if (s.rinshan) parts.push('嶺上')
  if (s.chankan) parts.push('搶槓')
  if (s.lastTile) parts.push('海底/河底')
  return parts.length > 0 ? parts.join('・') : 'なし'
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
              className={state.rinshan ? 'on' : ''}
              onClick={() => patch({ rinshan: !state.rinshan })}
            >
              嶺上開花
            </button>
            <button
              className={state.chankan ? 'on' : ''}
              onClick={() => patch({ chankan: !state.chankan })}
            >
              搶槓
            </button>
            <button
              className={state.lastTile ? 'on' : ''}
              onClick={() => patch({ lastTile: !state.lastTile })}
            >
              海底/河底
            </button>
          </div>
        </div>
        {isStandard && (
          <div className="seg-row">
            <span className="seg-label">ツモ払い</span>
            {!isDealer ? (
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
        <p className="sheet-note">
          嶺上開花はツモ側、搶槓はロン側の結果にのみ反映されます。
          {isStandard && 'ツモ払いの人数は和了済を除いた支払い相手の数です。'}
        </p>
      </div>
    </div>
  )
}
