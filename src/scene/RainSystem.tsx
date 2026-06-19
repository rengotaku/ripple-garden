import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshPhysicalMaterial, SphereGeometry } from 'three'
import {
  BARS,
  IMPACT_STRENGTH,
  POND_HALF,
  SPAWN_BURST_MAX,
  SPAWN_INTERVAL_MAX,
  SPAWN_INTERVAL_MIN,
  WATER_LEVEL,
  worldToUv,
} from '../config'
import { playNote, playWaterDrop } from '../audio/synth'
import type { WaterField } from '../water/waterField'
import { Drop } from './Drop'
import { Ripple, type RippleVariant } from './Ripple'
import { Splash } from './Splash'
import { XylophoneBar } from './XylophoneBar'

type DropState = { id: number; x: number; z: number; landY: number }
type RippleState = {
  id: number
  x: number
  z: number
  y: number
  variant: RippleVariant
}
type SplashState = { id: number; x: number; z: number; y: number }

const randRange = (min: number, max: number) => min + Math.random() * (max - min)
const randPond = () => randRange(-POND_HALF * 0.95, POND_HALF * 0.95)
const nextInterval = () => randRange(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX)

/** (x,z) が当たるバーの配列インデックスを返す。どれにも当たらなければ -1。 */
function barIndexAt(x: number, z: number): number {
  for (let i = 0; i < BARS.length; i++) {
    const [bx, , bz] = BARS[i].position
    const [sx, , sz] = BARS[i].size
    if (Math.abs(x - bx) <= sx / 2 && Math.abs(z - bz) <= sz / 2) {
      return i
    }
  }
  return -1
}

/** (x,z) に落ちた滴の着地高さ。バー上ならバー天面、なければ水面。 */
function landingYAt(x: number, z: number): number {
  const idx = barIndexAt(x, z)
  if (idx < 0) return WATER_LEVEL
  const bar = BARS[idx]
  return bar.position[1] + bar.size[1] / 2
}

/**
 * 放置系の中核。雨のように水滴を生成し、着水で波紋＋着水音を生む。
 * 鉄琴バーに当たれば音を鳴らし、水滴が弾けて飛沫になる。
 * 雫・波紋・飛沫の増減のみ React state で扱い、各オブジェクトのアニメーションは
 * 自身の useFrame に任せる。雫の形状/マテリアルは共有して生成コストを抑える。
 */
export function RainSystem({ field }: { field: WaterField }) {
  const [drops, setDrops] = useState<DropState[]>([])
  const [ripples, setRipples] = useState<RippleState[]>([])
  const [splashes, setSplashes] = useState<SplashState[]>([])
  const nextId = useRef(0)
  const spawnTimer = useRef(nextInterval())
  const elapsedRef = useRef(0)
  // バーごとの最終ヒット時刻。発光の減衰に使う。
  const hitRefs = useRef(BARS.map(() => ({ current: -999 })))

  // 雫・飛沫で共有する形状とマテリアル（夜の月明かりを拾うガラス質の水玉）。
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
        // 夜でも雫が暗く沈まないよう、控えめに発光（強すぎると Bloom で白飛びする）。
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
    elapsedRef.current = state.clock.elapsedTime
    spawnTimer.current -= delta
    if (spawnTimer.current <= 0) {
      spawnTimer.current = nextInterval()
      const burst = 1 + Math.floor(Math.random() * SPAWN_BURST_MAX)
      const fresh: DropState[] = []
      for (let i = 0; i < burst; i++) {
        const x = randPond()
        const z = randPond()
        fresh.push({ id: nextId.current++, x, z, landY: landingYAt(x, z) })
      }
      setDrops((prev) => [...prev, ...fresh])
    }
  })

  const handleLand = useCallback(
    (id: number, x: number, z: number) => {
      setDrops((prev) => prev.filter((d) => d.id !== id))

      const barIdx = barIndexAt(x, z)

      if (barIdx >= 0) {
        // 音の出るバーに着水 → 発音＋発光＋飛沫
        const bar = BARS[barIdx]
        const barTop = bar.position[1] + bar.size[1] / 2
        playNote(bar.note, x)
        hitRefs.current[barIdx].current = elapsedRef.current

        const splashId = nextId.current++
        setSplashes((prev) => [...prev, { id: splashId, x, z, y: barTop }])

        const rippleId = nextId.current++
        setRipples((prev) => [...prev, { id: rippleId, x, z, y: barTop, variant: 'hit' }])
        return
      }

      // 水面に着水 → リアルな着水音＋水面に波を注入＋波紋
      playWaterDrop(x)
      const [u, v] = worldToUv(x, z)
      field.impacts.push({ u, v, strength: IMPACT_STRENGTH })

      const rippleId = nextId.current++
      setRipples((prev) => [...prev, { id: rippleId, x, z, y: WATER_LEVEL, variant: 'normal' }])
    },
    [field],
  )

  const handleRippleDone = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const handleSplashDone = useCallback((id: number) => {
    setSplashes((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return (
    <group>
      {BARS.map((bar) => (
        <XylophoneBar key={bar.id} bar={bar} lastHitRef={hitRefs.current[bar.id]} />
      ))}

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

      {ripples.map((r) => (
        <Ripple
          key={r.id}
          id={r.id}
          x={r.x}
          z={r.z}
          y={r.y}
          variant={r.variant}
          onDone={handleRippleDone}
        />
      ))}
    </group>
  )
}
