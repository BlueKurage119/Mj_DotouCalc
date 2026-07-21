import { useMemo, useState } from 'react'
import { calcAlmighty, calcAlmightyFirstTake, type CalcOutcome, type MeldInput, type MeldType } from './core/almighty'
import { analyzeDiscards, analyzeWaits } from './core/analysis'
import { PRESETS, type PresetId, type RuleOptions } from './core/options'
import {
  EAST,
  NORTH,
  compareTiles,
  suitOf,
  tileName,
  type TileId,
  type TileInstance,
} from './core/tiles'
import { DiscardsPanel, WaitsPanel } from './ui/AnalysisPanel'
import { IconClose, IconDelete, IconSettings } from './ui/icons'
import { LuckSheet, luckSummary, type LuckState } from './ui/LuckSheet'
import { ResultPanel } from './ui/ResultPanel'
import { SettingsView } from './ui/SettingsView'
import { Tenkey } from './ui/Tenkey'
import { TileImage } from './ui/TileImage'

type TenkeyTarget = 'hand' | 'dora' | 'ura' | { meld: number }
type Popup = null | { kind: 'tenkey'; target: TenkeyTarget } | { kind: 'luck' }

const WIND_LABELS: Record<number, string> = { 28: '東', 29: '南', 30: '西', 31: '北' }
const WINDS: TileId[] = [EAST, EAST + 1, EAST + 2, NORTH]
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
    riichiState: 'none',
    ippatsu: false,
    rinshan: false,
    chankan: false,
    lastTile: false,
    firstTake: false,
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
  const hasAnyMeld = activeMelds.length > 0
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

  /**
   * 副露入力: 1牌なら自動補完 (ポン/カンは同一牌、チーは起点)。
   * 3-4牌なら形を検証して種別を自動判定 (3枚同一=ポン / 連続3=チー / 4枚同一=カン)。
   * 赤5は 0 入力 (例: 340m でチー三四赤五萬)
   */
  function fillMeld(i: number, tiles: TileInstance[]): string | null {
    const meld = melds[i]
    if (!meld || tiles.length === 0) return null
    let newTiles: TileInstance[]
    let newType: MeldType = meld.type
    if (tiles.length === 1) {
      const base = tiles[0]
      if (meld.type === 'chi') {
        if (suitOf(base.t) === 'z') return '字牌はチーできません'
        const n = ((base.t - 1) % 9) + 1
        if (n > 7) return `${tileName(base.t)}起点のチーはできません`
        newTiles = [base, { t: base.t + 1 }, { t: base.t + 2 }]
      } else {
        newTiles = [base, ...Array.from({ length: meldSize(meld.type) - 1 }, () => ({ t: base.t }))]
      }
    } else if (tiles.length === 3 || tiles.length === 4) {
      const sorted = [...tiles].sort((a, b) => a.t - b.t)
      const ts = sorted.map((x) => x.t)
      const allSame = ts.every((t) => t === ts[0])
      if (tiles.length === 4) {
        if (!allSame) return '槓は同じ牌4枚で入力してください'
        newType = meld.type === 'ankan' ? 'ankan' : 'minkan'
      } else if (allSame) {
        newType = 'pon'
      } else if (
        suitOf(ts[0]) !== 'z' &&
        suitOf(ts[0]) === suitOf(ts[2]) &&
        ts[1] === ts[0] + 1 &&
        ts[2] === ts[0] + 2
      ) {
        newType = 'chi'
      } else {
        return '副露の形 (チー/ポン/カン) になっていません'
      }
      newTiles = sorted
    } else {
      return '副露は3枚 (槓は4枚) で入力してください'
    }
    if (newTiles.filter((x) => x.red).length > 1) return '赤5は各色1枚までです'
    // 既存の副露牌を除いた上で使用可能かチェック
    const withoutThis = new Map(usedCount)
    for (const x of meld.tiles) withoutThis.set(x.t, (withoutThis.get(x.t) ?? 0) - 1)
    for (const [t, c] of countOf(newTiles)) {
      if ((withoutThis.get(t) ?? 0) + c > 4) return `${tileName(t)}が5枚以上になります`
    }
    const redSuits = new Set(newTiles.filter((x) => x.red).map((x) => suitOf(x.t)))
    if (redSuits.size > 0) {
      const others = [
        ...hand,
        ...doraInd,
        ...uraInd,
        ...melds.flatMap((m, j) => (j === i ? [] : m.tiles)),
      ]
      for (const x of others) {
        if (x.red && redSuits.has(suitOf(x.t))) return '赤5は各色1枚までです'
      }
    }
    const next = melds.slice()
    next[i] = { type: newType, tiles: newTiles }
    setMelds(next)
    // 手牌があふれる場合は末尾から削る
    const newCap = 13 - 3 * next.filter((m) => m.tiles.length > 0).length
    if (hand.length > newCap) setHand(hand.slice(0, newCap))
    // 副露(暗槓含む)が確定した時点で天和・地和は成立しなくなる。
    // 明槓/チー/ポンは立直・一発も無効にする。
    setLuck((l) => ({
      ...l,
      firstTake: false,
      ...(newType !== 'ankan' ? { riichiState: 'none' as const, ippatsu: false } : {}),
    }))
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
      // 副露内: タップで副露をクリアして入れ直し (赤は0入力で指定)
      deleteLast(target)
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
    // 手牌は和了牌(満杯時の末尾)以外を理牌
    if (popup?.kind === 'tenkey' && popup.target === 'hand') {
      setHand((h) => {
        const winSeparate = h.length === cap && h.length > 0
        const body = winSeparate ? h.slice(0, -1) : h
        const sorted = [...body].sort(compareTiles)
        return winSeparate ? [...sorted, h[h.length - 1]] : sorted
      })
    }
    setTenkeyError(null)
    setPopup(null)
  }

  function setMeldType(i: number, type: MeldType) {
    const meld = melds[i]
    if (!meld) return
    const next = melds.slice()
    // 明槓⇔暗槓は牌をそのまま引き継ぐ。それ以外は形が変わるため入れ直し
    const kanSwap =
      (type === 'minkan' || type === 'ankan') &&
      (meld.type === 'minkan' || meld.type === 'ankan') &&
      meld.tiles.length === 4
    next[i] = kanSwap ? { ...meld, type } : { type, tiles: [] }
    setMelds(next)
    setTenkeyError(null)
  }

  function removeMeld(i: number) {
    setMelds(melds.filter((_, j) => j !== i))
    setPopup(null)
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

  /** テンキーのACキー: 対象ゾーンの牌のみ全消去 */
  function clearZone(target: TenkeyTarget) {
    if (target === 'hand') setHand([])
    else if (target === 'dora') setDoraInd([])
    else if (target === 'ura') setUraInd([])
    else {
      const meld = melds[target.meld]
      if (!meld) return
      const next = melds.slice()
      next[target.meld] = { ...meld, tiles: [] }
      setMelds(next)
    }
    setTenkeyError(null)
  }

  function discardTile(t: TileId) {
    let idx = hand.findIndex((x) => x.t === t && !x.red)
    if (idx < 0) idx = hand.findIndex((x) => x.t === t)
    if (idx >= 0) setHand(hand.filter((_, j) => j !== idx))
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
      afterKan: false, // 嶺上/搶槓は和了計算時に側別で上書き
      lastTile: luck.lastTile,
      doraIndicators: doraInd,
      uraIndicators: riichiOn ? uraInd : [],
      koPayers: luck.koPayers,
      dealerPays: luck.dealerPays,
    }),
    [activeMelds, seatWind, roundWind, luck, riichiOn, doraInd, uraInd],
  )

  // 13枚相当: 末尾を和了牌としてツモ・ロン両方を計算。和了形でなければ何切る
  // 天和・地和 (luck.firstTake) の場合は、どの牌を和了牌として扱うかで
  // 国士十三面・純正九蓮宝燈・四暗刻単騎などの上位役が変わるため高目を自動選択する。
  // また天和・地和はツモ限定の役のためロン側は計算しない。
  const scoreTsumo = useMemo((): { outcome: CalcOutcome; winTile: TileInstance } | null => {
    if (!meldsComplete || hand.length !== cap) return null
    if (luck.firstTake) return calcAlmightyFirstTake({ ...baseInput, concealed: hand }, options)
    const winTile = hand[hand.length - 1]
    const outcome = calcAlmighty(
      {
        ...baseInput,
        afterKan: luck.rinshan,
        concealed: hand.slice(0, -1),
        winTile,
        isTsumo: true,
        firstTake: false,
      },
      options,
    )
    return { outcome, winTile }
  }, [meldsComplete, hand, cap, baseInput, luck.rinshan, luck.firstTake, options])

  const scoreRon = useMemo((): CalcOutcome | null => {
    if (!meldsComplete || hand.length !== cap || luck.firstTake) return null
    return calcAlmighty(
      {
        ...baseInput,
        afterKan: luck.chankan,
        concealed: hand.slice(0, -1),
        winTile: hand[hand.length - 1],
        isTsumo: false,
        firstTake: false,
      },
      options,
    )
  }, [meldsComplete, hand, cap, baseInput, luck.chankan, luck.firstTake, options])

  const isWin =
    (scoreTsumo !== null && (scoreTsumo.outcome.ok || scoreTsumo.outcome.hadNoYaku)) ||
    (scoreRon !== null && (scoreRon.ok || scoreRon.hadNoYaku))

  const discardsOutcome = useMemo(() => {
    if (!scoreTsumo) return null
    return analyzeDiscards({ ...baseInput, concealed: hand }, options)
  }, [scoreTsumo, baseInput, hand, options])

  // 12枚相当: 聴牌分析
  const waitsOutcome = useMemo(() => {
    if (!meldsComplete || hand.length !== cap - 1) return null
    return analyzeWaits({ ...baseInput, concealed: hand }, options)
  }, [meldsComplete, hand, cap, baseInput, options])

  // ---------- 表示 ----------
  const sortedHand = useMemo(() => {
    // 満杯時は和了牌を除いてソートし、和了牌を右端に分けて表示。
    // 通常は末尾の牌が和了牌。天和・地和 (luck.firstTake) のときは高目判定で
    // 選ばれた牌 (scoreTsumo.winTile) を和了牌として扱う。
    const winSeparate = hand.length === cap && hand.length > 0
    const winIndex = winSeparate
      ? scoreTsumo
        ? hand.indexOf(scoreTsumo.winTile)
        : hand.length - 1
      : -1
    const body = winSeparate ? hand.filter((_, i) => i !== winIndex) : hand
    const sorted = body
      .map((x) => ({ x, i: hand.indexOf(x) }))
      .sort((a, b) => compareTiles(a.x, b.x))
    return { sorted, win: winSeparate ? { x: hand[winIndex], i: winIndex } : null }
  }, [hand, cap, scoreTsumo])

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
        <div className="preset-seg">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button
              key={id}
              className={presetId === id ? 'on' : ''}
              onClick={() => selectPreset(id)}
            >
              {PRESETS[id].label}
            </button>
          ))}
        </div>
        <button className="text-btn icon-text-btn" onClick={() => setView('settings')}>
          <IconSettings /> 設定
        </button>
      </header>

      <main className="content">
        <div className="wind-sections">
          <div className="wind-section">
            <span className="wind-label">場風</span>
            <div className={`wind-seg${options.roundWindYaku ? '' : ' disabled'}`}>
              {WINDS.map((w) => (
                <button
                  key={w}
                  className={options.roundWindYaku && roundWind === w ? 'on' : ''}
                  disabled={!options.roundWindYaku}
                  onClick={() => setRoundWind(w)}
                >
                  {WIND_LABELS[w]}
                </button>
              ))}
            </div>
          </div>
          <div className="wind-section">
            <span className="wind-label">自風</span>
            <div className="wind-seg">
              {WINDS.map((w) => (
                <button
                  key={w}
                  className={seatWind === w ? 'on' : ''}
                  onClick={() => {
                    setSeatWind(w)
                    if (isStandard) setLuck((l) => ({ ...l, koPayers: w === EAST ? 3 : 2 }))
                  }}
                >
                  {WIND_LABELS[w]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="chip-grid">
          <div
            className="chip"
            role="button"
            tabIndex={0}
            onClick={() => {
              setTenkeyError(null)
              setPopup({ kind: 'tenkey', target: 'dora' })
            }}
          >
            <span className="chip-label">ドラ</span>
            <span className="chip-value tiles">
              {doraInd.length === 0 ? 'なし' : doraInd.map((x, i) => <TileImage key={i} tile={x} />)}
            </span>
            {doraInd.length > 0 && (
              <span
                className="chip-clear"
                aria-label="ドラをクリア"
                onClick={(e) => {
                  e.stopPropagation()
                  setDoraInd([])
                }}
              >
                <IconClose />
              </span>
            )}
          </div>
          <div
            className={`chip${riichiOn ? '' : ' disabled'}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!riichiOn) return
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
            {riichiOn && uraInd.length > 0 && (
              <span
                className="chip-clear"
                aria-label="裏ドラをクリア"
                onClick={(e) => {
                  e.stopPropagation()
                  setUraInd([])
                }}
              >
                <IconClose />
              </span>
            )}
          </div>
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
            手牌（＋和了牌） {hand.length}/{cap}
            {hand.length > 0 && (
              <span
                className="text-btn clear-mini"
                aria-label="全消去"
                onClick={(e) => {
                  e.stopPropagation()
                  clearAll()
                }}
              >
                <IconDelete />
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
          {melds.map((meld, i) => (
            <div
              key={i}
              className="card meld-card"
              role="button"
              tabIndex={0}
              onClick={() => openMeldEditor(i)}
            >
              <div className="card-label">
                副露{meld.tiles.length > 0 ? ` (${MELD_LABELS[meld.type]})` : ''}
                <span
                  className="text-btn clear-mini"
                  aria-label="副露を削除"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeMeld(i)
                  }}
                >
                  <IconClose />
                </span>
              </div>
              <div className="meld-tiles">
                {meld.tiles.length > 0 ? (
                  meld.tiles.map((x, j) => <TileImage key={j} tile={x} />)
                ) : (
                  <span className="hint">タップして入力</span>
                )}
              </div>
            </div>
          ))}
          {melds.length < 4 && (
            <button className="add-meld-btn" onClick={() => openMeldEditor(melds.length)}>
              ＋ 副露を追加
            </button>
          )}
        </div>

        <button className="card luck-card" onClick={() => setPopup({ kind: 'luck' })}>
          <div className="card-label">立直・偶然役関係</div>
          <div className="luck-summary">{luckSummary(luck, isStandard, isDealer, seatWind === EAST)}</div>
        </button>

        <div className="result-area">
          {isWin && scoreTsumo ? (
            <>
              <ResultPanel
                tsumo={scoreTsumo.outcome}
                ron={scoreRon}
                kiriage={options.kiriage}
                winTile={scoreTsumo.winTile}
              />
              {discardsOutcome && (
                <DiscardsPanel outcome={discardsOutcome} showBanner={false} onDiscard={discardTile} />
              )}
            </>
          ) : discardsOutcome ? (
            <DiscardsPanel outcome={discardsOutcome} onDiscard={discardTile} />
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

      {popup?.kind === 'tenkey' && (
        <Tenkey
          title={tenkeyTitle}
          tiles={tenkeyTiles}
          error={tenkeyError}
          onTileTap={(i) => tapZoneTile(popup.target, i)}
          onCommit={(tiles) => addTiles(popup.target, tiles)}
          onDeleteLast={() => deleteLast(popup.target)}
          onClearZone={() => clearZone(popup.target)}
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
          hasAnyMeld={hasAnyMeld}
          isStandard={isStandard}
          isDealer={isDealer}
          isEast={seatWind === EAST}
          onClose={() => setPopup(null)}
        />
      )}

      <footer className="footer">
        <p>牌画: FluffyStuff riichi-mahjong-tiles (public domain)</p>
      </footer>
    </div>
  )
}
