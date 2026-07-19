import { useMemo, useState } from 'react'
import { calcAlmighty, type MeldInput, type MeldType } from './core/almighty'
import { PRESETS, type PresetId, type RuleOptions } from './core/options'
import {
  ALL_TILES,
  EAST,
  NORTH,
  SOUTH,
  WEST,
  suitOf,
  type TileId,
  type TileInstance,
} from './core/tiles'
import { AlmightyFace, TileFace } from './ui/TileFace'
import { ResultPanel } from './ui/ResultPanel'

type Target = 'hand' | 'win' | 'dora' | 'ura' | { meld: number }

const WINDS: { id: TileId; label: string }[] = [
  { id: EAST, label: '東' },
  { id: SOUTH, label: '南' },
  { id: WEST, label: '西' },
  { id: NORTH, label: '北' },
]

const MELD_LABELS: Record<MeldType, string> = {
  chi: 'チー',
  pon: 'ポン',
  minkan: '明槓',
  ankan: '暗槓',
}

function meldSize(t: MeldType) {
  return t === 'chi' || t === 'pon' ? 3 : 4
}

interface EditableMeld {
  type: MeldType
  tiles: TileInstance[]
}

export default function App() {
  const [presetId, setPresetId] = useState<PresetId>('dotou')
  const [overrides, setOverrides] = useState<Partial<RuleOptions>>({})
  const [showSettings, setShowSettings] = useState(false)

  const [concealed, setConcealed] = useState<TileInstance[]>([])
  const [melds, setMelds] = useState<EditableMeld[]>([])
  const [winTile, setWinTile] = useState<TileInstance | null>(null)
  const [doraInd, setDoraInd] = useState<TileInstance[]>([])
  const [uraInd, setUraInd] = useState<TileInstance[]>([])
  const [target, setTarget] = useState<Target>('hand')

  const [isTsumo, setIsTsumo] = useState(true)
  const [seatWind, setSeatWind] = useState<TileId>(EAST)
  const [roundWind, setRoundWind] = useState<TileId>(EAST)
  const [riichiState, setRiichiState] = useState<'none' | 'riichi' | 'double'>('none')
  const [ippatsu, setIppatsu] = useState(false)
  const [afterKan, setAfterKan] = useState(false)
  const [lastTile, setLastTile] = useState(false)
  const [koPayers, setKoPayers] = useState(3)
  const [dealerPays, setDealerPays] = useState(true)

  const options: RuleOptions = useMemo(
    () => ({ ...PRESETS[presetId].options, ...overrides }),
    [presetId, overrides],
  )

  const handCapacity = 12 - 3 * melds.length
  const hasOpenMeld = melds.some((m) => m.type !== 'ankan')
  const riichiOn = riichiState !== 'none'

  // 使用済み枚数 (同一牌4枚まで / 赤5は各色1枚)
  const allUsed: TileInstance[] = useMemo(
    () => [
      ...concealed,
      ...melds.flatMap((m) => m.tiles),
      ...(winTile ? [winTile] : []),
      ...doraInd,
      ...uraInd,
    ],
    [concealed, melds, winTile, doraInd, uraInd],
  )
  const usedCount = useMemo(() => {
    const m = new Map<TileId, number>()
    for (const x of allUsed) m.set(x.t, (m.get(x.t) ?? 0) + 1)
    return m
  }, [allUsed])
  const redUsed = useMemo(() => {
    const s = new Set<string>()
    for (const x of allUsed) if (x.red) s.add(suitOf(x.t))
    return s
  }, [allUsed])

  function canAddToMeld(meld: EditableMeld, tile: TileInstance): boolean {
    if (meld.tiles.length >= meldSize(meld.type)) return false
    if (meld.type === 'chi') {
      if (suitOf(tile.t) === 'z') return false
      const ts = [...meld.tiles.map((x) => x.t), tile.t].sort((a, b) => a - b)
      if (new Set(ts).size !== ts.length) return false
      if (ts.some((t) => suitOf(t) !== suitOf(ts[0]))) return false
      return ts[ts.length - 1] - ts[0] <= 2
    }
    return meld.tiles.length === 0 || meld.tiles[0].t === tile.t
  }

  function addTile(tile: TileInstance) {
    const remaining = 4 - (usedCount.get(tile.t) ?? 0)
    if (remaining <= 0) return
    if (tile.red && redUsed.has(suitOf(tile.t))) return
    if (target === 'hand') {
      if (concealed.length < handCapacity) setConcealed([...concealed, tile])
    } else if (target === 'win') {
      setWinTile(tile)
    } else if (target === 'dora') {
      if (doraInd.length < 5) setDoraInd([...doraInd, tile])
    } else if (target === 'ura') {
      if (uraInd.length < 5) setUraInd([...uraInd, tile])
    } else {
      const i = target.meld
      const meld = melds[i]
      if (!meld || !canAddToMeld(meld, tile)) return
      const next = melds.slice()
      next[i] = { ...meld, tiles: [...meld.tiles, tile] }
      setMelds(next)
    }
  }

  function addMeld(type: MeldType) {
    if (melds.length >= 4) return
    // 副露を増やすと手牌上限が減るので溢れた分は削る
    const cap = 12 - 3 * (melds.length + 1)
    if (concealed.length > cap) setConcealed(concealed.slice(0, cap))
    setMelds([...melds, { type, tiles: [] }])
    setTarget({ meld: melds.length })
    if (type !== 'ankan') {
      setRiichiState('none')
      setIppatsu(false)
    }
  }

  function removeMeld(i: number) {
    setMelds(melds.filter((_, j) => j !== i))
    setTarget('hand')
  }

  function clearAll() {
    setConcealed([])
    setMelds([])
    setWinTile(null)
    setDoraInd([])
    setUraInd([])
    setTarget('hand')
  }

  const meldsComplete = melds.every((m) => m.tiles.length === meldSize(m.type))
  const inputComplete = concealed.length === handCapacity && winTile !== null && meldsComplete

  const outcome = useMemo(() => {
    if (!inputComplete || !winTile) return null
    return calcAlmighty(
      {
        concealed,
        melds: melds as MeldInput[],
        winTile,
        isTsumo,
        seatWind,
        roundWind,
        riichi: riichiState === 'riichi',
        doubleRiichi: riichiState === 'double',
        ippatsu: riichiOn && ippatsu,
        afterKan,
        lastTile,
        doraIndicators: doraInd,
        uraIndicators: riichiOn ? uraInd : [],
        koPayers,
        dealerPays,
      },
      options,
    )
  }, [
    inputComplete, concealed, melds, winTile, isTsumo, seatWind, roundWind,
    riichiState, riichiOn, ippatsu, afterKan, lastTile, doraInd, uraInd,
    koPayers, dealerPays, options,
  ])

  const sortedConcealed = useMemo(
    () =>
      concealed
        .map((x, i) => ({ x, i }))
        .sort((a, b) => a.x.t - b.x.t || Number(a.x.red ?? false) - Number(b.x.red ?? false)),
    [concealed],
  )

  const isDealer = options.payment === 'standard' && seatWind === EAST

  function selectPreset(id: PresetId) {
    setPresetId(id)
    setOverrides({})
    setKoPayers(id === 'shura' && seatWind !== EAST ? 2 : 3)
  }

  function toggle<K extends keyof RuleOptions>(key: K, value: RuleOptions[K]) {
    setOverrides((o) => ({ ...o, [key]: value }))
  }

  const targetIsMeld = typeof target === 'object'

  return (
    <div className="app">
      <header className="header">
        <h1>少牌マイティ点数計算</h1>
        <div className="preset-tabs">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button
              key={id}
              className={`preset-tab${presetId === id ? ' active' : ''}`}
              onClick={() => selectPreset(id)}
            >
              {PRESETS[id].label}
            </button>
          ))}
          <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
            ⚙ 詳細
          </button>
        </div>
      </header>

      {showSettings && (
        <section className="settings">
          <label>
            <span>支払い方式</span>
            <select
              value={options.payment}
              onChange={(e) => toggle('payment', e.target.value as RuleOptions['payment'])}
            >
              <option value="no-dealer">親なし (怒涛方式)</option>
              <option value="standard">通常 (親あり)</option>
            </select>
          </label>
          <label>
            <span>役牌: 場風</span>
            <input
              type="checkbox"
              checked={options.roundWindYaku}
              onChange={(e) => toggle('roundWindYaku', e.target.checked)}
            />
          </label>
          <label>
            <span>万能牌をドラとして数える</span>
            <input
              type="checkbox"
              checked={options.almightyDora === 'counted'}
              onChange={(e) => toggle('almightyDora', e.target.checked ? 'counted' : 'none')}
            />
          </label>
          <label>
            <span>高目判定から裏ドラを除外</span>
            <input
              type="checkbox"
              checked={options.rankingExcludesUra}
              onChange={(e) => toggle('rankingExcludesUra', e.target.checked)}
            />
          </label>
          <label>
            <span>高目判定からドラを全て除外</span>
            <input
              type="checkbox"
              checked={options.rankingExcludesDora}
              onChange={(e) => toggle('rankingExcludesDora', e.target.checked)}
            />
          </label>
          <label>
            <span>喰いタン</span>
            <input
              type="checkbox"
              checked={options.kuitan}
              onChange={(e) => toggle('kuitan', e.target.checked)}
            />
          </label>
          <label>
            <span>切り上げ満貫</span>
            <input
              type="checkbox"
              checked={options.kiriage}
              onChange={(e) => toggle('kiriage', e.target.checked)}
            />
          </label>
          <label>
            <span>ダブル役満</span>
            <input
              type="checkbox"
              checked={options.doubleYakuman}
              onChange={(e) => toggle('doubleYakuman', e.target.checked)}
            />
          </label>
        </section>
      )}

      <section className="zones">
        <div
          className={`zone${target === 'hand' ? ' active' : ''}`}
          onClick={() => setTarget('hand')}
        >
          <div className="zone-label">
            手牌 {concealed.length}/{handCapacity} <span className="plus">+</span> <AlmightyFace />
          </div>
          <div className="zone-tiles">
            {sortedConcealed.map(({ x, i }) => (
              <button
                key={i}
                className="tile-btn in-zone"
                onClick={(e) => {
                  e.stopPropagation()
                  setConcealed(concealed.filter((_, j) => j !== i))
                }}
              >
                <TileFace tile={x} />
              </button>
            ))}
            {concealed.length === 0 && <span className="hint">下の牌をタップして入力</span>}
          </div>
        </div>

        {melds.map((m, i) => (
          <div
            key={i}
            className={`zone meld${targetIsMeld && target.meld === i ? ' active' : ''}`}
            onClick={() => setTarget({ meld: i })}
          >
            <div className="zone-label">
              {MELD_LABELS[m.type]}
              <button
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  removeMeld(i)
                }}
              >
                ×
              </button>
            </div>
            <div className="zone-tiles">
              {m.tiles.map((x, j) => (
                <button
                  key={j}
                  className="tile-btn in-zone"
                  onClick={(e) => {
                    e.stopPropagation()
                    const next = melds.slice()
                    next[i] = { ...m, tiles: m.tiles.filter((_, k) => k !== j) }
                    setMelds(next)
                  }}
                >
                  <TileFace tile={x} />
                </button>
              ))}
              {m.tiles.length < meldSize(m.type) && (
                <span className="hint">あと{meldSize(m.type) - m.tiles.length}枚</span>
              )}
            </div>
          </div>
        ))}

        <div className="zone-row">
          <div
            className={`zone win${target === 'win' ? ' active' : ''}`}
            onClick={() => setTarget('win')}
          >
            <div className="zone-label">和了牌</div>
            <div className="zone-tiles">
              {winTile ? (
                <button
                  className="tile-btn in-zone"
                  onClick={(e) => {
                    e.stopPropagation()
                    setWinTile(null)
                  }}
                >
                  <TileFace tile={winTile} />
                </button>
              ) : (
                <span className="hint">未選択</span>
              )}
            </div>
          </div>
          <div className="agari-type">
            <button className={isTsumo ? 'active' : ''} onClick={() => setIsTsumo(true)}>
              ツモ
            </button>
            <button className={!isTsumo ? 'active' : ''} onClick={() => setIsTsumo(false)}>
              ロン
            </button>
          </div>
        </div>

        <div className="zone-row">
          <div
            className={`zone dora${target === 'dora' ? ' active' : ''}`}
            onClick={() => setTarget('dora')}
          >
            <div className="zone-label">ドラ表示牌</div>
            <div className="zone-tiles">
              {doraInd.map((x, i) => (
                <button
                  key={i}
                  className="tile-btn in-zone"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDoraInd(doraInd.filter((_, j) => j !== i))
                  }}
                >
                  <TileFace tile={x} />
                </button>
              ))}
              {doraInd.length === 0 && <span className="hint">なし</span>}
            </div>
          </div>
          <div
            className={`zone ura${target === 'ura' ? ' active' : ''}${riichiOn ? '' : ' disabled'}`}
            onClick={() => riichiOn && setTarget('ura')}
          >
            <div className="zone-label">裏ドラ表示牌</div>
            <div className="zone-tiles">
              {uraInd.map((x, i) => (
                <button
                  key={i}
                  className="tile-btn in-zone"
                  onClick={(e) => {
                    e.stopPropagation()
                    setUraInd(uraInd.filter((_, j) => j !== i))
                  }}
                >
                  <TileFace tile={x} />
                </button>
              ))}
              {uraInd.length === 0 && (
                <span className="hint">{riichiOn ? 'なし' : '立直時のみ'}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="meld-actions">
        {(['chi', 'pon', 'minkan', 'ankan'] as MeldType[]).map((mt) => (
          <button key={mt} onClick={() => addMeld(mt)} disabled={melds.length >= 4}>
            +{MELD_LABELS[mt]}
          </button>
        ))}
        <button className="clear-btn" onClick={clearAll}>
          全消去
        </button>
      </section>

      <Palette usedCount={usedCount} redUsed={redUsed} onAdd={addTile} />

      <section className="conditions">
        <div className="cond-row">
          <span className="cond-label">自風</span>
          {WINDS.map((w) => (
            <button
              key={w.id}
              className={seatWind === w.id ? 'active' : ''}
              onClick={() => {
                setSeatWind(w.id)
                if (options.payment === 'standard') setKoPayers(w.id === EAST ? 3 : 2)
              }}
            >
              {w.label}
            </button>
          ))}
          {options.payment === 'standard' && (
            <span className="dealer-badge">{isDealer ? '親' : '子'}</span>
          )}
        </div>
        {options.payment === 'standard' && (
          <div className="cond-row">
            <span className="cond-label">場風</span>
            {WINDS.map((w) => (
              <button
                key={w.id}
                className={roundWind === w.id ? 'active' : ''}
                onClick={() => setRoundWind(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}
        <div className="cond-row">
          <span className="cond-label">立直</span>
          <button
            className={riichiState === 'none' ? 'active' : ''}
            onClick={() => setRiichiState('none')}
          >
            なし
          </button>
          <button
            className={riichiState === 'riichi' ? 'active' : ''}
            disabled={hasOpenMeld}
            onClick={() => setRiichiState('riichi')}
          >
            立直
          </button>
          <button
            className={riichiState === 'double' ? 'active' : ''}
            disabled={hasOpenMeld}
            onClick={() => setRiichiState('double')}
          >
            W立直
          </button>
          <label className="chk">
            <input
              type="checkbox"
              disabled={!riichiOn}
              checked={riichiOn && ippatsu}
              onChange={(e) => setIppatsu(e.target.checked)}
            />
            一発
          </label>
        </div>
        <div className="cond-row">
          <label className="chk">
            <input
              type="checkbox"
              checked={afterKan}
              onChange={(e) => setAfterKan(e.target.checked)}
            />
            {isTsumo ? '嶺上開花' : '搶槓'}
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={lastTile}
              onChange={(e) => setLastTile(e.target.checked)}
            />
            {isTsumo ? '海底' : '河底'}
          </label>
        </div>
        {isTsumo && (
          <div className="cond-row">
            <span className="cond-label">ツモ支払い</span>
            {options.payment === 'standard' && !isDealer ? (
              <>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={dealerPays}
                    onChange={(e) => setDealerPays(e.target.checked)}
                  />
                  親が支払う
                </label>
                <span className="cond-label">子</span>
                {[0, 1, 2].map((n) => (
                  <button
                    key={n}
                    className={koPayers === n ? 'active' : ''}
                    onClick={() => setKoPayers(n)}
                  >
                    {n}人
                  </button>
                ))}
              </>
            ) : (
              <>
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    className={koPayers === n ? 'active' : ''}
                    onClick={() => setKoPayers(n)}
                  >
                    {n}人
                  </button>
                ))}
              </>
            )}
            <span className="hint">和了済・飛びは除く</span>
          </div>
        )}
      </section>

      <ResultPanel outcome={outcome} inputComplete={inputComplete} />

      <footer className="footer">
        <p>万能牌は最も点数が高くなる牌として自動計算されます ({PRESETS[presetId].label}ルール)</p>
      </footer>
    </div>
  )
}

function Palette({
  usedCount,
  redUsed,
  onAdd,
}: {
  usedCount: Map<TileId, number>
  redUsed: Set<string>
  onAdd: (tile: TileInstance) => void
}) {
  const rows: TileId[][] = [
    ALL_TILES.slice(0, 9),
    ALL_TILES.slice(9, 18),
    ALL_TILES.slice(18, 27),
    ALL_TILES.slice(27, 34),
  ]
  return (
    <section className="palette">
      {rows.map((row, ri) => (
        <div className="palette-row" key={ri}>
          {row.map((t) => {
            const left = 4 - (usedCount.get(t) ?? 0)
            return (
              <button key={t} className="tile-btn" disabled={left <= 0} onClick={() => onAdd({ t })}>
                <TileFace tile={{ t }} />
                <span className="left-count">{left}</span>
              </button>
            )
          })}
          {ri === 3 &&
            [5, 14, 23].map((t) => {
              const disabled = redUsed.has(suitOf(t)) || 4 - (usedCount.get(t) ?? 0) <= 0
              return (
                <button
                  key={`r${t}`}
                  className="tile-btn"
                  disabled={disabled}
                  onClick={() => onAdd({ t, red: true })}
                >
                  <TileFace tile={{ t, red: true }} />
                </button>
              )
            })}
        </div>
      ))}
    </section>
  )
}
