import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { type BufferGeometry, type Material, type Group } from 'three'
import { GRAVITY, WATER_LEVEL } from '../config'

export type SplashProps = {
  id: number
  x: number
  z: number
  y: number
  geometry: BufferGeometry
  material: Material
  onDone: (id: number) => void
}

const PARTICLES = 7
const LIFETIME = 0.65

type Particle = {
  vx: number
  vy: number
  vz: number
  px: number
  py: number
  pz: number
  size: number
}

/**
 * 音の出るバーに着水した瞬間、水滴が弾けて飛沫になる。
 * 小さな雫を放射状に飛ばし、重力で落としつつ縮小して消す（共有マテリアルなので
 * 透明度ではなくスケールでフェード）。
 */
export function Splash({ id, x, z, y, geometry, material, onDone }: SplashProps) {
  const group = useRef<Group>(null)
  const age = useRef(0)
  const done = useRef(false)

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLES }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.8 + Math.random() * 1.8
      return {
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 1.6 + Math.random() * 2.4,
        px: x,
        py: y,
        pz: z,
        size: 0.35 + Math.random() * 0.5,
      }
    })
  }, [x, y, z])

  useFrame((_, delta) => {
    const g = group.current
    if (!g || done.current) return

    age.current += delta
    const t = age.current / LIFETIME
    if (t >= 1) {
      done.current = true
      onDone(id)
      return
    }

    const shrink = 1 - t
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      p.vy -= GRAVITY * delta
      p.px += p.vx * delta
      p.py += p.vy * delta
      p.pz += p.vz * delta
      if (p.py < WATER_LEVEL) p.py = WATER_LEVEL

      const child = g.children[i]
      if (child) {
        child.position.set(p.px, p.py, p.pz)
        const s = p.size * shrink
        child.scale.set(s, s, s)
      }
    }
  })

  return (
    <group ref={group}>
      {particles.map((_, i) => (
        <mesh key={i} geometry={geometry} material={material} />
      ))}
    </group>
  )
}
