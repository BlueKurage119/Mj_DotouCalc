import { useMemo, useState } from 'react'
import { calcAlmighty, type MeldInput, type MeldType } from './core/almighty'
import { analyzeDiscards, analyzeWaits } from './core/analysis'
import { PRESETS, type PresetId, type RuleOptions } from './core/options'
import {
  EAST,
  NORTH,
  isFive,
  suitOf,
  tileName,
  type TileId,
  type TileInstance,
} from './core/tiles'
import { DiscardsPanel, WaitsPanel } from './ui/AnalysisPanel'
import { LuckSheet, luckSummary, type LuckState } from './ui/LuckSheet'
import { ResultPanel } from './ui/ResultPanel'
import { SettingsView } from './ui/SettingsView'
import { Tenkey } from './ui/Tenkey'
import { AlmightyBadge, TileImage } from './ui/TileImage'

type TenkeyTarget = 'hand' | 'dora' | 'ura' | { meld: number }
type Popup = null | { kind: 'tenkey'; target: TenkeyTarget } | { kind: 'luck' }

const WIND_LABELS: Record<number, string> = { 28: '東', 29: '南', 30: '西', 31: '北' }
const MELD_LABELS: Record<MeldType, string> = {
  chi: 'チー',
  pon: 'ポン',
  minkan: '明槓',
  ankan: '暗槓',
}

interface EditableMeld {
  type: MeldType
  tiles: TileInstance[]
}

const meldSize = (t: MeldType) => (t === 'chi' || t === 'pon' ? 3 : 4)
const nextWind = (w: TileId): TileId => (w === NORTH ? EAST : w + 1)

export default function App() {
  const [view, setView] = useState<'main' | 'settings'>('main')
  const [presetId, setPresetId] = useState<PresetId>('dotou')
  const [overrides, setOverrides] = useState<Partial<RuleOptions>>({})

  /** 手牌 (入力順を保持。満杯のとき末尾が和了牌) */
  const [hand, setHand] = useState<TileInstance[]>([])
  const [melds, setMelds] = useState<EditableMeld[]>([])
  const [doraInd, setDoraInd] = useState<TileInstance[]>([])
  const [uraInd, setUraInd] = useState<TileInstance[]>([])
  const [seatWind, setSeatWind] = useState<TileId>(EAST)
  const [roundWind, setRoundWind] = useState<TileId>(EAST)
  const [luck, setLuck] = useState<LuckState>({
    isTsumo: true,
    riichiState: 'none',
    ippatsu: false,
    afterKan: false,
    lastTile: false,
    koPayers: 3,
    dealerPays: true,
  })
  const [popup, setPopup] = useState<Popup>(null)
  const [tenkeyError, setTenkeyError] = useState<string | null>(null)

  const options: RuleOptions = useMemo(
    () => ({ ...PRESETS[presetId].options, ...overrides }),
    [presetId, overrides],
  )
  const isStandard = options.payment === 'standard'
  const isDealer = isStandard && seatWind === EAST
  const riichiOn = luck.riichiState !== 'none'
  const hasOpenMeld = melds.some((m) => m.type !== 'ankan' && m.tiles.length > 0)
  const activeMelds = melds.filter((m) => m.tiles.length > 0)
  const cap = 13 - 3 * activeMelds.length

  const allUsed: TileInstance[] = useMemo(
    () => [...hand, ...melds.flatMap((m) => m.tiles), ...doraInd, ...uraInd],
    [hand, melds, doraInd, uraInd],
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

  function canUse(tile: TileInstance, extraUsed: Map<TileId, number> | null = null): string | null {
    const used = (usedCount.get(tile.t) ?? 0) + (extraUsed?.get(tile.t) ?? 0)
    if (used >= 4) return `${tileName(tile.t)}は4枚使用済みです`
    if (tile.red && redUsed.has(suitOf(tile.t))) return '赤5は各色1枚までです'
    return null
  }

  /** テンキーからの牌追加 (対象ゾーンごとにバリデーション) */
  function addTiles(target: TenkeyTarget, tiles: TileInstance[]) {
    let error: string | null = null
    if (target === 'hand') {
      const next = [...hand]
      for (const tile of tiles) {
        if (next.length >= cap) {
          error = `手牌は${cap}枚までです`
          break
        }
        const e = canUse(tile, countOf(next.slice(hand.length)))
        if (e) {
          error = e
          continue
        }
        next.push(tile)
      }
      setHand(next)
    } else if (target === 'dora' || target === 'ura') {
      const list = target === 'dora' ? doraInd : uraInd
      const setList = target === 'dora' ? setDoraInd : setUraInd
      const next = [...list]
      for (const tile of tiles) {
        if (next.length >= 5) {
          error = '表示牌は5枚までです'
          break
        }
        const e = canUse(tile, countOf(next.slice(list.length)))
        if (e) {
          error = e
          continue
        }
        next.push(tile)
      }
      setList(next)
    } else {
      error = fillMeld(target.meld, tiles)
    }
    setTenkeyError(error)
  }

  function countOf(tiles: TileInstance[]): Map<TileId, number> {
    const m = new Map<TileId, number>()
    for (const x of tiles) m.set(x.t, (m.get(x.t) ?? 0) + 1)
    return m
  }

  /** 副露の自動補完: ポン/カンは同一牌、チーは入力牌を起点に3枚 */
  function fillMeld(i: number, tiles: TileInstance[]): string | null {
    const meld = melds[i]
    if (!meld || tiles.length === 0) return null
    const base = tiles[0]
    let newTiles: TileInstance[]
    if (meld.type === 'chi') {
      if (suitOf(base.t) === 'z') return '字牌はチーできません'
      const n = ((base.t - 1) % 9) + 1
      if (n > 7) return `${tileName(base.t)}起点のチーはできません`
      newTiles = [base, { t: base.t + 1 }, { t: base.t + 2 }]
    } else {
      const count = meldSize(meld.type)
      newTiles = Array.from({ length: count }, (_, k) => (k === 0 ? base : { t: base.t }))
      if (base.red) newTiles = [base, ...newTiles.slice(1).map(() => ({ t: base.t }))]
    }
    // 既存の副露牌を除いた上で使用可能かチェック
    const withoutThis = new Map(usedCount)
    for (const x of meld.tiles) withoutThis.set(x.t, (withoutThis.get(x.t) ?? 0) - 1)
    const adding = countOf(newTiles)
    for (const [t, c] of adding) {
      if ((withoutThis.get(t) ?? 0) + c > 4) return `${tileName(t)}が5枚以上になります`
    }
    if (newTiles.some((x) => x.red) && [...melds.flatMap((m, j) => (j === i ? [] : m.tiles)), ...hand, ...doraInd, ...uraInd].some((x) => x.red && suitOf(x.t) === suitOf(base.t))) {
      return '赤5は各色1枚までです'
    }
    const next = melds.slice()
    next[i] = { ...meld, tiles: newTiles }
    setMelds(next)
    // 手牌があふれる場合は末尾から削る
    const newCap = 13 - 3 * next.filter((m) => m.tiles.length > 0).length
    if (hand.length > newCap) setHand(hand.slice(0, newCap))
    if (meld.type !== 'ankan') setLuck((l) => ({ ...l, riichiState: 'none', ippatsu: false }))
    return null
  }

  function deleteLast(target: TenkeyTarget) {
    if (target === 'hand') setHand(hand.slice(0, -1))
    else if (target === 'dora') setDoraInd(doraInd.slice(0, -1))
    else if (target === 'ura') setUraInd(uraInd.slice(0, -1))
    else {
      const meld = melds[target.meld]
      if (!meld) return
      const next = melds.slice()
      next[target.meld] = { ...meld, tiles: [] }
      setMelds(next)
    }
    setTenkeyError(null)
  }

  /** テンキープレビュー上の牌タップ */
  function tapZoneTile(target: TenkeyTarget, index: number) {
    if (target === 'hand') setHand(hand.filter((_, j) => j !== index))
    else if (target === 'dora') setDoraInd(doraInd.filter((_, j) => j !== index))
    else if (target === 'ura') setUraInd(uraInd.filter((_, j) => j !== index))
    else {
      // 副露内: 5なら赤トグル、それ以外は副露をクリア
      const meld = melds[target.meld]
      if (!meld) return
      const tile = meld.tiles[index]
      if (tile && isFive(tile.t)) {
        const makeRed = !tile.red
        if (makeRed && redUsed.has(suitOf(tile.t))) {
          setTenkeyError('赤5は各色1枚までです')
          return
        }
        const next = melds.slice()
        next[target.meld] = {
          ...meld,
          tiles: meld.tiles.map((x, j) => (j === index ? { ...x, red: makeRed } : x)),
        }
        setMelds(next)
      } else {
        deleteLast(target)
      }
    }
    setTenkeyError(null)
  }

  function openMeldEditor(i: number) {
    let idx = i
    if (i >= melds.length) {
      idx = melds.length
      setMelds([...melds, { type: 'chi', tiles: [] }])
    }
    setTenkeyError(null)
    setPopup({ kind: 'tenkey', target: { meld: idx } })
  }

  function closeTenkey() {
    // 空の副露スロットは閉じるときに破棄
    setMelds((ms) => ms.filter((m) => m.tiles.length > 0))
    setTenkeyError(null)
    setPopup(null)
  }

  function setMeldType(i: number, type: MeldType) {
    const meld = melds[i]
    if (!meld) return
    const next = melds.slice()
    // 種別変更時は入れ直し (チー⇔ポン等で形が変わるため)
    next[i] = { type, tiles: [] }
    setMelds(next)
    setTenkeyError(null)
  }

  function selectPreset(id: PresetId) {
    setPresetId(id)
    setOverrides({})
    const std = PRESETS[id].options.payment === 'standard'
    setLuck((l) => ({ ...l, koPayers: std && seatWind !== EAST ? 2 : 3 }))
  }

  function toggle<K extends keyof RuleOptions>(key: K, value: RuleOptions[K]) {
    setOverrides((o) => ({ ...o, [key]: value }))
  }

  function clearAll() {
    setHand([])
    setMelds([])
    setDoraInd([])
    setUraInd([])
    setPopup(null)
    setTenkeyError(null)
  }

  // ---------- 計算 ----------
  const meldsComplete = activeMelds.every((m) => m.tiles.length === meldSize(m.type))
  const baseInput = useMemo(
    () => ({
      melds: activeMelds as MeldInput[],
      seatWind,
      roundWind,
      riichi: luck.riichiState === 'riichi',
      doubleRiichi: luck.riichiState === 'double',
      ippatsu: riichiOn && luck.ippatsu,
      afterKan: luck.afterKan,
      lastTile: luck.lastTile,
      doraIndicators: doraInd,
      uraIndicators: riichiOn ? uraInd : [],
      koPayers: luck.koPayers,
      dealerPays: luck.dealerPays,
    }),
    [activeMelds, seatWind, roundWind, luck, riichiOn, doraInd, uraInd],
  )

  // 13枚相当: 末尾を和了牌として点数計算、和了形でなければ何切る
  const scoreOutcome = useMemo(() => {
    if (!meldsComplete || hand.length !== cap) return null
    return calcAlmighty(
      { ...baseInput, concealed: hand.slice(0, -1), winTile: hand[hand.length - 1], isTsumo: luck.isTsumo },
      options,
    )
  }, [meldsComplete, hand, cap, baseInput, luck.isTsumo, options])

  const discardsOutcome = useMemo(() => {
    if (!scoreOutcome || scoreOutcome.ok || scoreOutcome.hadNoYaku) return null
    return analyzeDiscards({ ...baseInput, concealed: hand })
  }, [scoreOutcome, baseInput, hand])

  // 12枚相当: 聴牌分析
  const waitsOutcome = useMemo(() => {
    if (!meldsComplete || hand.length !== cap - 1) return null
    return analyzeWaits({ ...baseInput, concealed: hand }, options)
  }, [meldsComplete, hand, cap, baseInput, options])

  // ---------- 表示 ----------
  const sortedHand = useMemo(() => {
    // 満杯時は末尾(和了牌)を除いてソートし、和了牌を右端に分けて表示
    const winSeparate = hand.length === cap && hand.length > 0
    const body = winSeparate ? hand.slice(0, -1) : hand
    const sorted = body
      .map((x, i) => ({ x, i }))
      .sort((a, b) => a.x.t - b.x.t || Number(a.x.red ?? false) - Number(b.x.red ?? false))
    return { sorted, win: winSeparate ? { x: hand[hand.length - 1], i: hand.length - 1 } : null }
  }, [hand, cap])

  if (view === 'settings') {
    return (
      <div className={`app theme-${presetId}`}>
        <SettingsView
          options={options}
          toggle={toggle}
          presetLabel={PRESETS[presetId].label}
          onReset={() => setOverrides({})}
          onBack={() => setView('main')}
        />
      </div>
    )
  }

  const meldTarget = popup?.kind === 'tenkey' && typeof popup.target === 'object' ? popup.target.meld : null
  const tenkeyTiles =
    popup?.kind !== 'tenkey'
      ? []
      : popup.target === 'hand'
        ? hand
        : popup.target === 'dora'
          ? doraInd
          : popup.target === 'ura'
            ? uraInd
            : (melds[meldTarget!]?.tiles ?? [])
  const tenkeyTitle =
    popup?.kind !== 'tenkey'
      ? ''
      : popup.target === 'hand'
        ? `手牌 (${hand.length}/${cap})`
        : popup.target === 'dora'
          ? 'ドラ表示牌'
          : popup.target === 'ura'
            ? '裏ドラ表示牌'
            : '副露'

  return (
    <div className={`app theme-${presetId}`}>
      <header className="appbar">
        <select
          className="preset-select"
          value={presetId}
          onChange={(e) => selectPreset(e.target.value as PresetId)}
        >
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <option key={id} value={id}>
              {PRESETS[id].label}
            </option>
          ))}
        </select>
        <button className="text-btn" onClick={() => setView('settings')}>
          ⚙ 設定
        </button>
      </header>

      <main className="content">
        <div className="chip-grid">
          <button
            className={`chip${options.roundWindYaku ? '' : ' disabled'}`}
            disabled={!options.roundWindYaku}
            onClick={() => setRoundWind(nextWind(roundWind))}
          >
            <span className="chip-label">場風</span>
            <span className="chip-value">
              {options.roundWindYaku ? WIND_LABELS[roundWind] : 'なし'}
            </span>
          </button>
          <button
            className="chip"
            onClick={() => {
              const w = nextWind(seatWind)
              setSeatWind(w)
              if (isStandard) setLuck((l) => ({ ...l, koPayers: w === EAST ? 3 : 2 }))
            }}
          >
            <span className="chip-label">自風</span>
            <span className="chip-value">
              {WIND_LABELS[seatWind]}
              {isStandard && <em className="dealer-mini">{isDealer ? '親' : '子'}</em>}
            </span>
          </button>
          <button
            className="chip"
            onClick={() => {
              setTenkeyError(null)
              setPopup({ kind: 'tenkey', target: 'dora' })
            }}
          >
            <span className="chip-label">ドラ</span>
            <span className="chip-value tiles">
              {doraInd.length === 0 ? 'なし' : doraInd.map((x, i) => <TileImage key={i} tile={x} />)}
            </span>
          </button>
          <button
            className={`chip${riichiOn ? '' : ' disabled'}`}
            disabled={!riichiOn}
            onClick={() => {
              setTenkeyError(null)
              setPopup({ kind: 'tenkey', target: 'ura' })
            }}
          >
            <span className="chip-label">裏ドラ</span>
            <span className="chip-value tiles">
              {!riichiOn
                ? '立直時のみ'
                : uraInd.length === 0
                  ? 'なし'
                  : uraInd.map((x, i) => <TileImage key={i} tile={x} />)}
            </span>
          </button>
        </div>

        <div
          className="card hand-card"
          role="button"
          tabIndex={0}
          onClick={() => {
            setTenkeyError(null)
            setPopup({ kind: 'tenkey', target: 'hand' })
          }}
        >
          <div className="card-label">
            手牌（＋和了牌） {hand.length}/{cap} <AlmightyBadge />
            {hand.length > 0 && (
              <span
                className="text-btn clear-mini"
                onClick={(e) => {
                  e.stopPropagation()
                  clearAll()
                }}
              >
                全消去
              </span>
            )}
          </div>
          <div className="hand-tiles">
            {sortedHand.sorted.map(({ x, i }) => (
              <span
                key={i}
                className="hand-tile"
                onClick={(e) => {
                  e.stopPropagation()
                  setHand(hand.filter((_, j) => j !== i))
                }}
              >
                <TileImage tile={x} />
              </span>
            ))}
            {sortedHand.win && (
              <>
                <span className="win-sep" />
                <span
                  className="hand-tile win"
                  onClick={(e) => {
                    e.stopPropagation()
                    setHand(hand.filter((_, j) => j !== sortedHand.win!.i))
                  }}
                >
                  <TileImage tile={sortedHand.win.x} />
                </span>
              </>
            )}
            {hand.length === 0 && <span className="hint">タップして牌を入力</span>}
          </div>
        </div>

        <div className="meld-grid">
          {[0, 1, 2, 3].map((i) => {
            const meld = melds[i]
            return (
              <button key={i} className="card meld-card" onClick={() => openMeldEditor(i)}>
                <div className="card-label">
                  副露{meld && meld.tiles.length > 0 ? ` (${MELD_LABELS[meld.type]})` : ''}
                </div>
                <div className="meld-tiles">
                  {meld && meld.tiles.length > 0 ? (
                    meld.tiles.map((x, j) => <TileImage key={j} tile={x} />)
                  ) : (
                    <span className="hint">なし</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <button className="card luck-card" onClick={() => setPopup({ kind: 'luck' })}>
          <div className="card-label">立直・偶然役関係</div>
          <div className="luck-summary">{luckSummary(luck, hasOpenMeld)}</div>
        </button>

        <div className="result-area">
          {scoreOutcome && (scoreOutcome.ok || scoreOutcome.hadNoYaku) ? (
            <ResultPanel outcome={scoreOutcome} inputComplete />
          ) : discardsOutcome ? (
            <DiscardsPanel
              outcome={discardsOutcome}
              onDiscard={(t) => {
                let idx = hand.findIndex((x) => x.t === t && !x.red)
                if (idx < 0) idx = hand.findIndex((x) => x.t === t)
                if (idx >= 0) setHand(hand.filter((_, j) => j !== idx))
              }}
            />
          ) : waitsOutcome ? (
            <WaitsPanel outcome={waitsOutcome} onPickWait={(t) => addTiles('hand', [{ t }])} />
          ) : (
            <section className="result waiting">
              <p>
                手牌{cap - 1}枚で待ち分析、{cap}枚で点数計算/何切る分析します
              </p>
            </section>
          )}
        </div>
      </main>

      <button
        className="fab"
        aria-label="牌を入力"
        onClick={() => {
          setTenkeyError(null)
          setPopup({ kind: 'tenkey', target: 'hand' })
        }}
      >
        ✏️
      </button>

      {popup?.kind === 'tenkey' && (
        <Tenkey
          title={tenkeyTitle}
          tiles={tenkeyTiles}
          error={tenkeyError}
          onTileTap={(i) => tapZoneTile(popup.target, i)}
          onCommit={(tiles) => addTiles(popup.target, tiles)}
          onDeleteLast={() => deleteLast(popup.target)}
          onClose={closeTenkey}
          extra={
            meldTarget !== null && melds[meldTarget] ? (
              <div className="seg meld-type-seg">
                {(['chi', 'pon', 'minkan', 'ankan'] as MeldType[]).map((mt) => (
                  <button
                    key={mt}
                    className={melds[meldTarget].type === mt ? 'on' : ''}
                    onClick={() => setMeldType(meldTarget, mt)}
                  >
                    {MELD_LABELS[mt]}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        />
      )}
      {popup?.kind === 'luck' && (
        <LuckSheet
          state={luck}
          patch={(p) => setLuck((l) => ({ ...l, ...p }))}
          hasOpenMeld={hasOpenMeld}
          isStandard={isStandard}
          isDealer={isDealer}
          onClose={() => setPopup(null)}
        />
      )}

      <footer className="footer">
        <p>
          万能牌は最も点数が高くなる牌として自動計算 ({PRESETS[presetId].label}ルール) ・ 牌画:
          FluffyStuff riichi-mahjong-tiles (public domain)
        </p>
      </footer>
    </div>
  )
}
