import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { type Group, MeshPhysicalMaterial, SphereGeometry } from 'three'
import {
  BARS,
  IMPACT_STRENGTH,
  POND_HALF,
  RAIN_FOCUS_X_HALF,
  RAIN_FOCUS_Z_CENTER,
  RAIN_FOCUS_Z_HALF,
  SLIDE_AMP_X,
  SLIDE_AMP_Z,
  WATER_LEVEL,
  worldToUv,
} from '../config'
import { settings } from '../state/settings'
import { playNote, playWaterDrop } from '../audio/synth'
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
  const rate = settings.rain * MAX_RATE
  if (rate <= 0.01) return Infinity
  return (1 / rate) * randRange(0.5, 1.5)
}

/** (localX, localZ)（バー基準のローカル座標）が当たるバーの index を返す。なければ -1。 */
function barIndexAt(localX: number, localZ: number): number {
  for (let i = 0; i < BARS.length; i++) {
    const [bx, , bz] = BARS[i].position
    const [sx, , sz] = BARS[i].size
    if (Math.abs(localX - bx) <= sx / 2 && Math.abs(localZ - bz) <= sz / 2) {
      return i
    }
  }
  return -1
}

/** ローカル座標での着地高さ。バー上ならバー天面、なければ水面。 */
function landingYAt(localX: number, localZ: number): number {
  const idx = barIndexAt(localX, localZ)
  if (idx < 0) return WATER_LEVEL
  const bar = BARS[idx]
  return bar.position[1] + bar.size[1] / 2
}

/**
 * 放置系の中核。雨量（スライダー）に応じて水滴を生成し、着水で波紋＋着水音を生む。
 * 鉄琴バーに当たれば発音＋発光＋飛沫。自動スライドモードではバー列がゆっくり動き、
 * 当たる滴が移り変わって音楽が変化する。
 */
export function RainSystem({ field }: { field: WaterField }) {
  const [drops, setDrops] = useState<DropState[]>([])
  const [splashes, setSplashes] = useState<SplashState[]>([])
  const nextId = useRef(0)
  const spawnTimer = useRef(0.1)
  const elapsedRef = useRef(0)
  const hitRefs = useRef(BARS.map(() => ({ current: -999 })))
  const barGroup = useRef<Group>(null)
  // バー列の現在のスライドオフセット（自動スライドモードで更新）。
  const slide = useRef({ x: 0, z: 0 })

  const dropGeometry = useMemo(() => new SphereGeometry(0.06, 16, 16), [])
  const dropMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#dff3ff',
        roughness: 0.02,
        metalness: 0,
        transparent: true,
        opacity: 0.78,
        ior: 1.33,
        clearcoat: 1,
        clearcoatRoughness: 0,
        envMapIntensity: 2.2,
        emissive: '#4aa0d8',
        emissiveIntensity: 0.25,
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
        // 雨はバー付近に集中（自動スライド時は中心がバー列に追従）。
        const x = clamp(
          slide.current.x + randRange(-RAIN_FOCUS_X_HALF, RAIN_FOCUS_X_HALF),
          -POND_EDGE,
          POND_EDGE,
        )
        const z = clamp(
          slide.current.z + RAIN_FOCUS_Z_CENTER + randRange(-RAIN_FOCUS_Z_HALF, RAIN_FOCUS_Z_HALF),
          -POND_EDGE,
          POND_EDGE,
        )
        const landY = landingYAt(x - slide.current.x, z - slide.current.z)
        setDrops((prev) => [...prev, { id: nextId.current++, x, z, landY }])
      }
    }
  })

  const handleLand = useCallback(
    (id: number, x: number, z: number) => {
      setDrops((prev) => prev.filter((d) => d.id !== id))

      const localX = x - slide.current.x
      const localZ = z - slide.current.z
      const barIdx = barIndexAt(localX, localZ)

      if (barIdx >= 0) {
        const bar = BARS[barIdx]
        const barTop = bar.position[1] + bar.size[1] / 2
        playNote(bar.note, x)
        hitRefs.current[barIdx].current = elapsedRef.current

        const splashId = nextId.current++
        setSplashes((prev) => [...prev, { id: splashId, x, z, y: barTop }])
        return
      }

      // 水面に着水 → 着水音＋水面シムへ波を注入（波紋は GPU シミュレーションが描く）。
      playWaterDrop(x)
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
        {BARS.map((bar) => (
          <XylophoneBar key={bar.id} bar={bar} lastHitRef={hitRefs.current[bar.id]} />
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
