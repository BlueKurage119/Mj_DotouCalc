import { useEffect, useState, type ReactNode } from 'react'
import type { TileInstance } from '../core/tiles'
import { TileImage } from './TileImage'

const HONOR_LABELS = ['東', '南', '西', '北', '白', '發', '中']

/** 数字バッファ + スート確定 (m/p/s/z) → TileInstance[] */
function resolve(buffer: string, suit: 'm' | 'p' | 's' | 'z'): TileInstance[] {
  const out: TileInstance[] = []
  const offset = suit === 'm' ? 0 : suit === 'p' ? 9 : suit === 's' ? 18 : 27
  for (const ch of buffer) {
    const n = Number(ch)
    if (suit === 'z') {
      if (n >= 1 && n <= 7) out.push({ t: 27 + n })
      continue // 0,8,9 は字牌に存在しないので無視
    }
    if (n === 0) out.push({ t: offset + 5, red: true })
    else out.push({ t: offset + n })
  }
  return out
}

export interface TenkeyProps {
  title: string
  /** 対象ゾーンの現在の牌 (プレビュー表示) */
  tiles: TileInstance[]
  /** 親からのバリデーションメッセージ */
  error: string | null
  /** ゾーン牌タップ (削除や赤トグルは親が決める) */
  onTileTap?: (index: number) => void
  onCommit: (tiles: TileInstance[]) => void
  onDeleteLast: () => void
  onClose: () => void
  /** タイトル下に差し込む追加UI (副露種別チップなど) */
  extra?: ReactNode
}

export function Tenkey({ title, tiles, error, onTileTap, onCommit, onDeleteLast, onClose, extra }: TenkeyProps) {
  const [buffer, setBuffer] = useState('')

  function pushDigit(d: string) {
    if (buffer.length < 14) setBuffer(buffer + d)
  }

  function commitSuit(suit: 'm' | 'p' | 's' | 'z') {
    if (buffer.length === 0) return
    onCommit(resolve(buffer, suit))
    setBuffer('')
  }

  function backspace() {
    if (buffer.length > 0) setBuffer(buffer.slice(0, -1))
    else onDeleteLast()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        pushDigit(e.key)
      } else if (['m', 'p', 's', 'z'].includes(e.key.toLowerCase())) {
        commitSuit(e.key.toLowerCase() as 'm' | 'p' | 's' | 'z')
      } else if (e.key === 'Backspace') {
        backspace()
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        onClose()
      } else {
        return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">
          <span>{title}</span>
          <span className="tenkey-hint">数字→m/p/s/zで入力 (0=赤5)</span>
        </div>
        {extra}
        <div className="tenkey-preview">
          {tiles.map((x, i) => (
            <button key={i} className="tile-btn" onClick={() => onTileTap?.(i)}>
              <TileImage tile={x} />
            </button>
          ))}
          <span className="tenkey-buffer">{buffer}‸</span>
        </div>
        {error && <div className="tenkey-error">{error}</div>}
        <div className="tenkey-grid">
          {(['m', 'p', 's', 'z'] as const).map((s) => (
            <button key={s} className="key suit" onClick={() => commitSuit(s)}>
              {s}
            </button>
          ))}
          {[7, 8, 9].map((n) => (
            <button key={n} className="key" onClick={() => pushDigit(String(n))}>
              {n}
              {n <= 7 && <small>{HONOR_LABELS[n - 1]}</small>}
            </button>
          ))}
          <button className="key fn" onClick={backspace}>
            ⌫
          </button>
          {[4, 5, 6].map((n) => (
            <button key={n} className="key" onClick={() => pushDigit(String(n))}>
              {n}
              <small>{HONOR_LABELS[n - 1]}</small>
            </button>
          ))}
          <button className="key fn" onClick={onClose}>
            ✕
          </button>
          {[1, 2, 3].map((n) => (
            <button key={n} className="key" onClick={() => pushDigit(String(n))}>
              {n}
              <small>{HONOR_LABELS[n - 1]}</small>
            </button>
          ))}
          <button className="key enter" onClick={onClose}>
            ↵
          </button>
          <button className="key zero" onClick={() => pushDigit('0')}>
            0<small>赤5</small>
          </button>
        </div>
      </div>
    </div>
  )
}
