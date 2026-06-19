import { useCallback, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BAR,
  POND_HALF,
  SPAWN_INTERVAL_MAX,
  SPAWN_INTERVAL_MIN,
} from '../config'
import { playHit } from '../audio/synth'
import { Drop } from './Drop'
import { Ripple, type RippleVariant } from './Ripple'
import { XylophoneBar } from './XylophoneBar'

type DropState = { id: number; x: number; z: number }
type RippleState = { id: number; x: number; z: number; variant: RippleVariant }

const randRange = (min: number, max: number) => min + Math.random() * (max - min)
const randPond = () => randRange(-POND_HALF * 0.95, POND_HALF * 0.95)
const nextInterval = () => randRange(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX)

/** (x,z) が鉄琴バーの XZ 範囲内かどうか。 */
function isOnBar(x: number, z: number): boolean {
  const [bx, , bz] = BAR.position
  const [sx, , sz] = BAR.size
  return Math.abs(x - bx) <= sx / 2 && Math.abs(z - bz) <= sz / 2
}

/**
 * 放置系の中核。一定のゆらぎで水滴を生成し、着水で波紋を生み、
 * 鉄琴バーに当たれば音を鳴らす。滴・波紋の増減のみ React state で扱い、
 * 各オブジェクトのアニメーションは自身の useFrame に任せる。
 */
export function RainSystem() {
  const [drops, setDrops] = useState<DropState[]>([])
  const [ripples, setRipples] = useState<RippleState[]>([])
  const nextId = useRef(0)
  const spawnTimer = useRef(nextInterval())
  const elapsedRef = useRef(0)
  const lastHitRef = useRef(-999)

  useFrame((state, delta) => {
    elapsedRef.current = state.clock.elapsedTime
    spawnTimer.current -= delta
    if (spawnTimer.current <= 0) {
      spawnTimer.current = nextInterval()
      const id = nextId.current++
      setDrops((prev) => [...prev, { id, x: randPond(), z: randPond() }])
    }
  })

  const handleLand = useCallback((id: number, x: number, z: number) => {
    setDrops((prev) => prev.filter((d) => d.id !== id))

    const hit = isOnBar(x, z)
    if (hit) {
      playHit()
      lastHitRef.current = elapsedRef.current
    }

    const rippleId = nextId.current++
    setRipples((prev) => [
      ...prev,
      { id: rippleId, x, z, variant: hit ? 'hit' : 'normal' },
    ])
  }, [])

  const handleRippleDone = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return (
    <group>
      <XylophoneBar lastHitRef={lastHitRef} />

      {drops.map((d) => (
        <Drop key={d.id} id={d.id} x={d.x} z={d.z} onLand={handleLand} />
      ))}

      {ripples.map((r) => (
        <Ripple
          key={r.id}
          id={r.id}
          x={r.x}
          z={r.z}
          variant={r.variant}
          onDone={handleRippleDone}
        />
      ))}
    </group>
  )
}
