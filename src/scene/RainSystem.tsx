import { useCallback, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BARS,
  IMPACT_STRENGTH,
  IMPACT_STRENGTH_HIT,
  POND_HALF,
  SPAWN_INTERVAL_MAX,
  SPAWN_INTERVAL_MIN,
  WATER_LEVEL,
  worldToUv,
} from '../config'
import { playNote } from '../audio/synth'
import type { WaterField } from '../water/waterField'
import { Drop } from './Drop'
import { Ripple, type RippleVariant } from './Ripple'
import { XylophoneBar } from './XylophoneBar'

type DropState = { id: number; x: number; z: number; landY: number }
type RippleState = {
  id: number
  x: number
  z: number
  y: number
  variant: RippleVariant
}

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
 * 放置系の中核。一定のゆらぎで水滴を生成し、着水で波紋を生み、
 * 鉄琴バーに当たれば音を鳴らす。滴・波紋の増減のみ React state で扱い、
 * 各オブジェクトのアニメーションは自身の useFrame に任せる。
 */
export function RainSystem({ field }: { field: WaterField }) {
  const [drops, setDrops] = useState<DropState[]>([])
  const [ripples, setRipples] = useState<RippleState[]>([])
  const nextId = useRef(0)
  const spawnTimer = useRef(nextInterval())
  const elapsedRef = useRef(0)
  // バーごとの最終ヒット時刻。発光の減衰に使う。
  const hitRefs = useRef(BARS.map(() => ({ current: -999 })))

  useFrame((state, delta) => {
    elapsedRef.current = state.clock.elapsedTime
    spawnTimer.current -= delta
    if (spawnTimer.current <= 0) {
      spawnTimer.current = nextInterval()
      const id = nextId.current++
      const x = randPond()
      const z = randPond()
      setDrops((prev) => [...prev, { id, x, z, landY: landingYAt(x, z) }])
    }
  })

  const handleLand = useCallback((id: number, x: number, z: number) => {
    setDrops((prev) => prev.filter((d) => d.id !== id))

    const barIdx = barIndexAt(x, z)
    const hit = barIdx >= 0
    if (hit) {
      playNote(BARS[barIdx].note, x)
      hitRefs.current[barIdx].current = elapsedRef.current
    }

    // 水面そのものへ波を注入（全ての滴）。
    const [u, v] = worldToUv(x, z)
    field.impacts.push({
      u,
      v,
      strength: hit ? IMPACT_STRENGTH_HIT : IMPACT_STRENGTH,
    })

    const rippleId = nextId.current++
    const y = hit ? BARS[barIdx].position[1] + BARS[barIdx].size[1] / 2 : WATER_LEVEL
    setRipples((prev) => [
      ...prev,
      { id: rippleId, x, z, y, variant: hit ? 'hit' : 'normal' },
    ])
  }, [field])

  const handleRippleDone = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return (
    <group>
      {BARS.map((bar) => (
        <XylophoneBar key={bar.id} bar={bar} lastHitRef={hitRefs.current[bar.id]} />
      ))}

      {drops.map((d) => (
        <Drop key={d.id} id={d.id} x={d.x} z={d.z} landY={d.landY} onLand={handleLand} />
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
