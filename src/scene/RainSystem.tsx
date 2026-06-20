import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshPhysicalMaterial, SphereGeometry } from 'three'
import {
  type BarDef,
  circleFocusRadius,
  IMPACT_STRENGTH,
  levelToCount,
  makeBars,
  POND_HALF,
  RAIN_FOCUS_Z_CENTER,
  RAIN_FOCUS_Z_HALF,
  rowFocusXHalf,
  WATER_LEVEL,
  worldToUv,
} from '../config'
import { getLayoutSnapshot, settings, subscribeLayout } from '../state/settings'
import { playNote } from '../audio/synth'
import { SONGS, noteToMidi } from '../audio/songs'
import type { WaterField } from '../water/waterField'
import { Drop } from './Drop'
import { Splash } from './Splash'
import { XylophoneBar } from './XylophoneBar'

type DropState = { id: number; x: number; z: number; landY: number; startY?: number }
type SplashState = { id: number; x: number; z: number; y: number }

/** 雨量スライダー最大時の毎秒生成数。 */
const MAX_RATE = 22

const randRange = (min: number, max: number) => min + Math.random() * (max - min)
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const POND_EDGE = POND_HALF * 0.97

/** 現在の雨量から次の滴までの間隔（秒）。停止中/雨量0なら Infinity。 */
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

/** 指定音に最も近い音のバー index（曲演奏で雨を落とす先）。 */
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

/** 着地高さ。バー上ならバー天面、なければ水面。 */
function landingYAt(bars: readonly BarDef[], x: number, z: number): number {
  const idx = barIndexAt(bars, x, z)
  if (idx < 0) return WATER_LEVEL
  const bar = bars[idx]
  return bar.position[1] + bar.size[1] / 2
}

/**
 * 放置系の中核。雨量に応じて水滴を生成し、着水で水面へ波を注入、
 * バー命中で発音＋発光＋飛沫。音域スライダーで本数（音域の幅）、
 * 配置トグルで一列／円形が変わる（円形は的が密集して当たりやすい＝賑やか）。
 */
export function RainSystem({ field }: { field: WaterField }) {
  const [drops, setDrops] = useState<DropState[]>([])
  const [splashes, setSplashes] = useState<SplashState[]>([])
  const nextId = useRef(0)
  const spawnTimer = useRef(0.1)
  const elapsedRef = useRef(0)
  // 曲演奏の進行状態。
  const songIdRef = useRef('')
  const melodyRef = useRef<unknown>(null) // 現在のメロディ配列の参照（差し替え検出用）
  const melodyIndex = useRef(0)
  const melodyTimer = useRef(0)
  // 曲演奏の雫が「正確に鳴らす音」を id ごとに保持（最寄りバーに落としつつ正音を発音）。
  const noteOverrides = useRef(new Map<number, string>())

  // 音域＋配置 → バー列を動的生成（変更で板を作り直す）。
  const layout = useSyncExternalStore(subscribeLayout, getLayoutSnapshot, getLayoutSnapshot)
  const bars = useMemo(
    () => makeBars(levelToCount(settings.rangeLevel), settings.barShape),
    // layout が変わったら作り直す
    [layout],
  )
  const hitRefs = useMemo(() => bars.map(() => ({ current: -999 })), [bars])

  // 雨を散らす範囲（配置で異なる）。
  const isCircle = useMemo(() => settings.barShape === 'circle', [layout])
  const focusX = useMemo(() => rowFocusXHalf(bars), [bars])
  const circleR = useMemo(() => circleFocusRadius(bars), [bars])

  // コールバック/フレームから最新値を読む参照。
  const barsRef = useRef(bars)
  barsRef.current = bars
  const hitRefsRef = useRef(hitRefs)
  hitRefsRef.current = hitRefs

  const dropGeometry = useMemo(() => new SphereGeometry(0.024, 10, 10), [])
  const dropMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#cfeeff',
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.34,
        ior: 1.33,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.0,
      }),
    [],
  )
  useEffect(() => {
    return () => {
      dropGeometry.dispose()
      dropMaterial.dispose()
    }
  }, [dropGeometry, dropMaterial])

  useFrame((state, delta) => {
    elapsedRef.current = state.clock.elapsedTime

    // --- 曲演奏モード（曲が選ばれている間はランダム雨を止め、メロディを雨で奏でる） ---
    const songId = settings.song
    const song =
      songId === 'custom'
        ? settings.customMelody && settings.customMelody.length
          ? { notes: settings.customMelody, tempo: 0.3 }
          : null
        : songId
          ? SONGS[songId]
          : null
    if (song) {
      // 曲が変わった or なぞり直しでメロディ配列が差し替わったら先頭から。
      if (songIdRef.current !== songId || melodyRef.current !== song.notes) {
        songIdRef.current = songId
        melodyRef.current = song.notes
        melodyIndex.current = 0
        melodyTimer.current = 0
      }
      melodyTimer.current -= delta
      if (melodyTimer.current <= 0) {
        const ev = song.notes[melodyIndex.current]
        if (ev.note) {
          const curBars = barsRef.current
          const idx = nearestBarIndex(curBars, ev.note)
          if (idx >= 0) {
            const bar = curBars[idx]
            const barTop = bar.position[1] + bar.size[1] / 2
            const id = nextId.current++
            noteOverrides.current.set(id, ev.note) // 最寄りバーに落としつつ正音を鳴らす
            setDrops((prev) => [
              ...prev,
              { id, x: bar.position[0], z: bar.position[2], landY: barTop, startY: barTop + 1.0 },
            ])
          }
        }
        melodyTimer.current += ev.beats * song.tempo
        melodyIndex.current = (melodyIndex.current + 1) % song.notes.length
      }
      return
    }
    songIdRef.current = ''

    // --- ランダム雨モード ---
    spawnTimer.current -= delta
    if (spawnTimer.current <= 0) {
      const interval = nextInterval()
      if (!isFinite(interval)) {
        spawnTimer.current = 0.3 // 停止/雨量0 の間は時々再チェック
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

      // 曲演奏の雫は「正確な音」を持つ（最寄りバーへ落としつつこの音を鳴らす）。
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

      // バー外: 曲演奏の音だけは確実に鳴らす。それ以外は水面へ波を注入。
      if (override !== undefined) {
        playNote(override, x)
        return
      }
      const [u, v] = worldToUv(x, z)
      field.impacts.push({ u, v, strength: IMPACT_STRENGTH })
    },
    [field],
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
          material={dropMaterial}
          onDone={handleSplashDone}
        />
      ))}
    </group>
  )
}
