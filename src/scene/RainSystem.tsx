import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, MeshBasicMaterial, SphereGeometry } from 'three'
import {
  type BarDef,
  circleFocusRadius,
  levelToCount,
  makeBars,
  POND_HALF,
  RAIN_FOCUS_Z_CENTER,
  RAIN_FOCUS_Z_HALF,
  rowFocusXHalf,
  WATER_LEVEL,
} from '../config'
import { getLayoutSnapshot, settings, subscribeLayout } from '../state/settings'
import { getLayers } from '../state/layers'
import { playNote } from '../audio/synth'
import { noteToMidi } from '../audio/songs'
import { noteSec } from '../score/drawMelody'
import { Drop } from './Drop'
import { Splash } from './Splash'
import { XylophoneBar } from './XylophoneBar'

type DropState = { id: number; x: number; z: number; landY: number; startY?: number }
type SplashState = { id: number; x: number; z: number; y: number }

/** 星の量スライダー最大時の毎秒生成数。 */
const MAX_RATE = 22

const randRange = (min: number, max: number) => min + Math.random() * (max - min)
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const POND_EDGE = POND_HALF * 0.97

/** 現在の星の量から次の星までの間隔（秒）。停止中/星の量0なら Infinity。 */
function nextInterval(): number {
  if (!settings.rainOn) return Infinity
  const rate = settings.rain * MAX_RATE
  if (rate <= 0.01) return Infinity
  return (1 / rate) * randRange(0.5, 1.5)
}

/** ワールド (x,z) が当たるバーの index。バーの回転を考慮してローカル AABB 判定。 */
function barIndexAt(bars: readonly BarDef[], x: number, z: number): number {
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]
    const dx = x - b.position[0]
    const dz = z - b.position[2]
    const c = Math.cos(b.rotationY)
    const s = Math.sin(b.rotationY)
    const lx = dx * c - dz * s
    const lz = dx * s + dz * c
    if (Math.abs(lx) <= b.size[0] / 2 && Math.abs(lz) <= b.size[2] / 2) return i
  }
  return -1
}

/** 指定音に最も近い音のバー index（曲演奏で星を落とす先）。 */
function nearestBarIndex(bars: readonly BarDef[], note: string): number {
  const target = noteToMidi(note)
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < bars.length; i++) {
    const d = Math.abs(noteToMidi(bars[i].note) - target)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/** 着地高さ。バー上ならバー天面、なければ着地面。 */
function landingYAt(bars: readonly BarDef[], x: number, z: number): number {
  const idx = barIndexAt(bars, x, z)
  if (idx < 0) return WATER_LEVEL
  const bar = bars[idx]
  return bar.position[1] + bar.size[1] / 2
}

/**
 * 放置系の中核。星の量に応じて落ちる星を生成し、着地で波紋へ波を注入、
 * バー命中で発音＋発光＋飛沫。音域スライダーで本数（音域の幅）、
 * 配置トグルで一列／円形が変わる（円形は的が密集して当たりやすい＝賑やか）。
 */
export function RainSystem() {
  const [drops, setDrops] = useState<DropState[]>([])
  const [splashes, setSplashes] = useState<SplashState[]>([])
  const nextId = useRef(0)
  const spawnTimer = useRef(0.1)
  const elapsedRef = useRef(0)
  // レイヤーごとの再生状態（index と次の音までの残り時間）。
  const layerState = useRef(new Map<number, { index: number; timer: number }>())
  // 曲演奏の星が「正確に鳴らす音」を id ごとに保持（最寄りバーに落としつつ正音を発音）。
  const noteOverrides = useRef(new Map<number, string>())
  // 星トグルの直前値。停止に切り替わった瞬間を検出して飛行中の星を消すため。
  const prevRainOn = useRef(settings.rainOn)

  // 音域＋配置 → バー列を動的生成（変更で板を作り直す）。
  const layout = useSyncExternalStore(subscribeLayout, getLayoutSnapshot, getLayoutSnapshot)
  const bars = useMemo(
    () => makeBars(levelToCount(settings.rangeLevel), settings.barShape),
    // layout が変わったら作り直す
    [layout],
  )
  const hitRefs = useMemo(() => bars.map(() => ({ current: -999 })), [bars])

  // 星を散らす範囲（配置で異なる）。
  const isCircle = useMemo(() => settings.barShape === 'circle', [layout])
  const focusX = useMemo(() => rowFocusXHalf(bars), [bars])
  const circleR = useMemo(() => circleFocusRadius(bars), [bars])

  // コールバック/フレームから最新値を読む参照。
  const barsRef = useRef(bars)
  barsRef.current = bars
  const hitRefsRef = useRef(hitRefs)
  hitRefsRef.current = hitRefs

  // 宇宙なので「落ちる星」。小さく明るい光点（落下中は筋を引いて流星のように）。
  const dropGeometry = useMemo(() => new SphereGeometry(0.05, 10, 10), [])
  const dropMaterial = useMemo(
    () => new MeshBasicMaterial({ color: '#eaf4ff', toneMapped: false }),
    [],
  )
  // 弾けた飛沫は淡く（半透明・加算でやわらかい光の粒に）。
  const splashMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#aed8f0',
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => {
    return () => {
      dropGeometry.dispose()
      dropMaterial.dispose()
      splashMaterial.dispose()
    }
  }, [dropGeometry, dropMaterial, splashMaterial])

  // 1 音を「最寄りのバーへ落とす星」として出す（正音はサンプラーで鳴らす）。
  const spawnMelodyDrop = (note: string) => {
    const curBars = barsRef.current
    const idx = nearestBarIndex(curBars, note)
    if (idx < 0) return
    const bar = curBars[idx]
    const barTop = bar.position[1] + bar.size[1] / 2
    const id = nextId.current++
    noteOverrides.current.set(id, note)
    setDrops((prev) => [
      ...prev,
      { id, x: bar.position[0], z: bar.position[2], landY: barTop, startY: barTop + 4.0 },
    ])
  }

  useFrame((state, delta) => {
    elapsedRef.current = state.clock.elapsedTime

    // 星停止に切り替わった瞬間、飛行中のアンビエント星を即クリア（曲の星=noteOverrides 持ちは残す）。
    if (prevRainOn.current && !settings.rainOn) {
      setDrops((prev) => prev.filter((d) => noteOverrides.current.has(d.id)))
    }
    prevRainOn.current = settings.rainOn

    // --- なぞって作曲のレイヤーを同時ループ再生 ---
    const layers = getLayers()
    const activeIds = new Set<number>()
    for (const layer of layers) {
      if (!layer.enabled || !layer.notes.length) continue
      activeIds.add(layer.id)
      let st = layerState.current.get(layer.id)
      if (!st) {
        st = { index: 0, timer: 0 }
        layerState.current.set(layer.id, st)
      }
      st.timer -= delta
      if (st.timer <= 0) {
        const ev = layer.notes[st.index % layer.notes.length]
        for (const n of ev.notes) spawnMelodyDrop(n) // 1 ステップに複数音なら和音として同時発音
        st.timer += ev.beats * noteSec(layer.tempo, settings.fallSpeed) // 旋律ごと×全体の落下速度（場全体の速さ）
        st.index = (st.index + 1) % layer.notes.length
      }
    }
    // 無効化/削除されたレイヤーの状態は破棄。
    for (const id of layerState.current.keys()) {
      if (!activeIds.has(id)) layerState.current.delete(id)
    }

    // --- ランダムに降る星（アンビエント。星の量/停止トグルで制御。レイヤーと同時に流れる） ---
    spawnTimer.current -= delta
    if (spawnTimer.current <= 0) {
      const interval = nextInterval()
      if (!isFinite(interval)) {
        spawnTimer.current = 0.3 // 停止/星の量0 の間は時々再チェック
      } else {
        spawnTimer.current = interval
        let x: number
        let z: number
        if (isCircle) {
          // 円盤状に散らす（バーの円を覆う）。
          const rr = circleR * Math.sqrt(Math.random())
          const a = Math.random() * Math.PI * 2
          x = clamp(Math.cos(a) * rr, -POND_EDGE, POND_EDGE)
          z = clamp(Math.sin(a) * rr, -POND_EDGE, POND_EDGE)
        } else {
          x = clamp(randRange(-focusX, focusX), -POND_EDGE, POND_EDGE)
          z = clamp(
            RAIN_FOCUS_Z_CENTER + randRange(-RAIN_FOCUS_Z_HALF, RAIN_FOCUS_Z_HALF),
            -POND_EDGE,
            POND_EDGE,
          )
        }
        const landY = landingYAt(barsRef.current, x, z)
        setDrops((prev) => [...prev, { id: nextId.current++, x, z, landY }])
      }
    }
  })

  const handleLand = useCallback(
    (id: number, x: number, z: number) => {
      setDrops((prev) => prev.filter((d) => d.id !== id))

      // 曲演奏の星は「正確な音」を持つ（最寄りバーへ落としつつこの音を鳴らす）。
      const override = noteOverrides.current.get(id)
      if (override !== undefined) noteOverrides.current.delete(id)

      const curBars = barsRef.current
      const barIdx = barIndexAt(curBars, x, z)

      if (barIdx >= 0) {
        const bar = curBars[barIdx]
        const barTop = bar.position[1] + bar.size[1] / 2
        playNote(override ?? bar.note, x)
        hitRefsRef.current[barIdx].current = elapsedRef.current

        const splashId = nextId.current++
        setSplashes((prev) => [...prev, { id: splashId, x, z, y: barTop }])
        return
      }

      // バー外: 曲演奏の音だけは確実に鳴らす。それ以外（外れた星）は静かに消える。
      if (override !== undefined) {
        playNote(override, x)
      }
    },
    [],
  )

  const handleSplashDone = useCallback((id: number) => {
    setSplashes((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return (
    <group>
      {bars.map((bar) => (
        <XylophoneBar key={bar.id} bar={bar} lastHitRef={hitRefs[bar.id]} />
      ))}

      {drops.map((d) => (
        <Drop
          key={d.id}
          id={d.id}
          x={d.x}
          z={d.z}
          startY={d.startY}
          landY={d.landY}
          geometry={dropGeometry}
          material={dropMaterial}
          onLand={handleLand}
        />
      ))}

      {splashes.map((s) => (
        <Splash
          key={s.id}
          id={s.id}
          x={s.x}
          z={s.z}
          y={s.y}
          geometry={dropGeometry}
          material={splashMaterial}
          onDone={handleSplashDone}
        />
      ))}
    </group>
  )
}
