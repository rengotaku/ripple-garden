import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useFrame } from '@react-three/fiber'
import { type Group, MeshPhysicalMaterial, SphereGeometry } from 'three'
import {
  type BarDef,
  barsSpread,
  IMPACT_STRENGTH,
  levelToCount,
  makeBars,
  POND_HALF,
  RAIN_FOCUS_Z_CENTER,
  RAIN_FOCUS_Z_HALF,
  SLIDE_AMP_X,
  SLIDE_AMP_Z,
  WATER_LEVEL,
  worldToUv,
} from '../config'
import { getRangeLevel, settings, subscribeRangeLevel } from '../state/settings'
import { playNote } from '../audio/synth'
import type { WaterField } from '../water/waterField'
import { Drop } from './Drop'
import { Splash } from './Splash'
import { XylophoneBar } from './XylophoneBar'

type DropState = { id: number; x: number; z: number; landY: number }
type SplashState = { id: number; x: number; z: number; y: number }

/** 雨量スライダー最大時の毎秒生成数。 */
const MAX_RATE = 22

const randRange = (min: number, max: number) => min + Math.random() * (max - min)
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const POND_EDGE = POND_HALF * 0.97

/** 現在の雨量から次の滴までの間隔（秒）を決める。雨量 0 なら Infinity（生成しない）。 */
function nextInterval(): number {
  if (!settings.rainOn) return Infinity // 停止トグル
  const rate = settings.rain * MAX_RATE
  if (rate <= 0.01) return Infinity
  return (1 / rate) * randRange(0.5, 1.5)
}

/** (localX, localZ)（バー基準のローカル座標）が当たるバーの index を返す。なければ -1。 */
function barIndexAt(bars: readonly BarDef[], localX: number, localZ: number): number {
  for (let i = 0; i < bars.length; i++) {
    const [bx, , bz] = bars[i].position
    const [sx, , sz] = bars[i].size
    if (Math.abs(localX - bx) <= sx / 2 && Math.abs(localZ - bz) <= sz / 2) {
      return i
    }
  }
  return -1
}

/** ローカル座標での着地高さ。バー上ならバー天面、なければ水面。 */
function landingYAt(bars: readonly BarDef[], localX: number, localZ: number): number {
  const idx = barIndexAt(bars, localX, localZ)
  if (idx < 0) return WATER_LEVEL
  const bar = bars[idx]
  return bar.position[1] + bar.size[1] / 2
}

/**
 * 放置系の中核。雨量（スライダー）に応じて水滴を生成し、着水で波紋＋着水音を生む。
 * 鉄琴バーに当たれば発音＋発光＋飛沫。音域スライダーでバー本数（音域の幅）が変わり、
 * 自動スライドモードではバー列がゆっくり動いて当たる滴が移り変わる。
 */
export function RainSystem({ field }: { field: WaterField }) {
  const [drops, setDrops] = useState<DropState[]>([])
  const [splashes, setSplashes] = useState<SplashState[]>([])
  const nextId = useRef(0)
  const spawnTimer = useRef(0.1)
  const elapsedRef = useRef(0)
  const barGroup = useRef<Group>(null)
  const slide = useRef({ x: 0, z: 0 })

  // 音域スライダー → バー列を動的生成（変更で板を作り直す）。
  const rangeLevel = useSyncExternalStore(subscribeRangeLevel, getRangeLevel, getRangeLevel)
  const bars = useMemo(() => makeBars(levelToCount(rangeLevel)), [rangeLevel])
  const hitRefs = useMemo(() => bars.map(() => ({ current: -999 })), [bars])
  // 雨を散らす横幅。狭い音域でも一点集中して水面シムが飽和しないよう下限を設ける。
  const focusXHalf = useMemo(() => Math.max(barsSpread(bars) / 2 + 0.6, 3.8), [bars])

  // 毎フレーム/コールバックから最新値を読むための参照。
  const barsRef = useRef(bars)
  barsRef.current = bars
  const hitRefsRef = useRef(hitRefs)
  hitRefsRef.current = hitRefs
  const focusRef = useRef(focusXHalf)
  focusRef.current = focusXHalf

  // 雨粒は小さく（ベストプラクティス: 細く小さい半透明の筋）。
  const dropGeometry = useMemo(() => new SphereGeometry(0.024, 10, 10), [])
  const dropMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        // 透明な水滴: しっかり透ける低不透明度＋クリアコートのつや。
        // 発光なし（“光る玉”に見えるのを防ぐ）。背景が透けて見えるので透明感が出る。
        color: '#cfeeff',
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.34, // 低めでしっかり透ける
        ior: 1.33, // 水の屈折率（フレネルのエッジ感）
        clearcoat: 1, // 表面のつや（ハイライトで雫だと分かる）
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
    const t = state.clock.elapsedTime
    elapsedRef.current = t

    // 自動スライド: ゆっくりした 2 軸の揺れでバー列が池を巡る。
    if (settings.autoSlide) {
      slide.current.x = Math.cos(t * 0.13) * SLIDE_AMP_X
      slide.current.z = Math.sin(t * 0.2) * SLIDE_AMP_Z
    } else {
      slide.current.x = 0
      slide.current.z = 0
    }
    if (barGroup.current) {
      barGroup.current.position.x = slide.current.x
      barGroup.current.position.z = slide.current.z
    }

    spawnTimer.current -= delta
    if (spawnTimer.current <= 0) {
      const interval = nextInterval()
      if (!isFinite(interval)) {
        spawnTimer.current = 0.3 // 雨が止んでいる間は時々再チェック
      } else {
        spawnTimer.current = interval
        // 雨はバー付近に集中（横幅は音域＝バー列に追従、自動スライドで中心も移動）。
        const fx = focusRef.current
        const x = clamp(slide.current.x + randRange(-fx, fx), -POND_EDGE, POND_EDGE)
        const z = clamp(
          slide.current.z + RAIN_FOCUS_Z_CENTER + randRange(-RAIN_FOCUS_Z_HALF, RAIN_FOCUS_Z_HALF),
          -POND_EDGE,
          POND_EDGE,
        )
        const landY = landingYAt(barsRef.current, x - slide.current.x, z - slide.current.z)
        setDrops((prev) => [...prev, { id: nextId.current++, x, z, landY }])
      }
    }
  })

  const handleLand = useCallback(
    (id: number, x: number, z: number) => {
      setDrops((prev) => prev.filter((d) => d.id !== id))

      const localX = x - slide.current.x
      const localZ = z - slide.current.z
      const curBars = barsRef.current
      const barIdx = barIndexAt(curBars, localX, localZ)

      if (barIdx >= 0) {
        const bar = curBars[barIdx]
        const barTop = bar.position[1] + bar.size[1] / 2
        playNote(bar.note, x)
        hitRefsRef.current[barIdx].current = elapsedRef.current

        const splashId = nextId.current++
        setSplashes((prev) => [...prev, { id: splashId, x, z, y: barTop }])
        return
      }

      // 水面に着水 → 水面シムへ波を注入（波紋は GPU シミュレーションが描く。着水音は無し）。
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
      <group ref={barGroup}>
        {bars.map((bar) => (
          <XylophoneBar key={bar.id} bar={bar} lastHitRef={hitRefs[bar.id]} />
        ))}
      </group>

      {drops.map((d) => (
        <Drop
          key={d.id}
          id={d.id}
          x={d.x}
          z={d.z}
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
