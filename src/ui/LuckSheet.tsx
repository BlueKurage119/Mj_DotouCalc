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
  /** 配牌時和了 (天和・地和)。ツモ限定で、他の立直・偶然役とは排他 */
  firstTake: boolean
  koPayers: number
  dealerPays: boolean
}

/** ツモ払い設定の表示 (通常方式のみ)。例: "3人" / " 親+子2人" / " 親のみ" / " 子2人" */
function tsumoPayLabel(s: LuckState, isDealer: boolean): string {
  if (isDealer) return `${s.koPayers}人`
  if (s.dealerPays) return s.koPayers >= 1 ? ` 親+子${s.koPayers}人` : ' 親のみ'
  return ` 子${s.koPayers}人`
}

export function luckSummary(
  s: LuckState,
  isStandard = false,
  isDealer = false,
  isEast = false,
): string {
  const parts: string[] = []
  if (s.firstTake) parts.push(isEast ? '天和' : '地和')
  if (s.riichiState === 'riichi') parts.push('立直')
  if (s.riichiState === 'double') parts.push('W立直')
  if (s.riichiState !== 'none' && s.ippatsu) parts.push('一発')
  if (s.rinshan) parts.push('嶺上')
  if (s.chankan) parts.push('搶槓')
  if (s.lastTile) parts.push('海底/河底')
  if (isStandard) parts.push(`ツモ払い${tsumoPayLabel(s, isDealer)}`)
  return parts.length > 0 ? parts.join('・') : 'なし'
}

export function LuckSheet({
  state,
  patch,
  hasOpenMeld,
  hasAnyMeld,
  isStandard,
  isDealer,
  isEast,
  onClose,
}: {
  state: LuckState
  patch: (p: Partial<LuckState>) => void
  hasOpenMeld: boolean
  /** 副露 (暗槓含む) が1つでもあるか。天和・地和は副露があると成立しない */
  hasAnyMeld: boolean
  /** 通常(親あり)方式か */
  isStandard: boolean
  isDealer: boolean
  /** 自風が東家か (天和/地和のラベル切り替えに使用。isDealerは方式限定の意味のため流用しない) */
  isEast: boolean
  onClose: () => void
}) {
  const riichiOn = state.riichiState !== 'none'
  const firstTakeOn = state.firstTake
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
          <span className="seg-label">配牌和了</span>
          <div className="seg">
            <button
              className={firstTakeOn ? 'on' : ''}
              disabled={hasAnyMeld}
              onClick={() =>
                patch(
                  firstTakeOn
                    ? { firstTake: false }
                    : {
                        firstTake: true,
                        riichiState: 'none',
                        ippatsu: false,
                        rinshan: false,
                        chankan: false,
                        lastTile: false,
                      },
                )
              }
            >
              {isEast ? '天和' : '地和'}
            </button>
          </div>
        </div>
        <div className="seg-row">
          <span className="seg-label">立直</span>
          <div className="seg">
            <button
              className={state.riichiState === 'none' ? 'on' : ''}
              disabled={firstTakeOn}
              onClick={() => patch({ riichiState: 'none', ippatsu: false })}
            >
              なし
            </button>
            <button
              className={state.riichiState === 'riichi' ? 'on' : ''}
              disabled={hasOpenMeld || firstTakeOn}
              onClick={() => patch({ riichiState: 'riichi' })}
            >
              立直
            </button>
            <button
              className={state.riichiState === 'double' ? 'on' : ''}
              disabled={hasOpenMeld || firstTakeOn}
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
              disabled={!riichiOn || firstTakeOn}
              onClick={() => patch({ ippatsu: !state.ippatsu })}
            >
              一発
            </button>
            <button
              className={state.rinshan ? 'on' : ''}
              disabled={firstTakeOn}
              onClick={() => patch({ rinshan: !state.rinshan })}
            >
              嶺上開花
            </button>
            <button
              className={state.chankan ? 'on' : ''}
              disabled={firstTakeOn}
              onClick={() => patch({ chankan: !state.chankan })}
            >
              搶槓
            </button>
            <button
              className={state.lastTile ? 'on' : ''}
              disabled={firstTakeOn}
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
                  onClick={() => {
                    const nextDealerPays = !state.dealerPays
                    patch(
                      !nextDealerPays && state.koPayers === 0
                        ? { dealerPays: nextDealerPays, koPayers: 1 }
                        : { dealerPays: nextDealerPays },
                    )
                  }}
                >
                  親が払う
                </button>
                {[0, 1, 2].map((n) => (
                  <button
                    key={n}
                    className={state.koPayers === n ? 'on' : ''}
                    disabled={n === 0 && !state.dealerPays}
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
          天和・地和はツモ和了のみ計算します(ロン側は非表示)。
          嶺上開花はツモ側、搶槓はロン側の結果にのみ反映されます。
          {isStandard && 'ツモ払いの人数は和了済を除いた支払い相手の数です。'}
        </p>
      </div>
    </div>
  )
}
