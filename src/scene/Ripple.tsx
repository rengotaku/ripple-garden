import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshBasicMaterial } from 'three'
import {
  HIT_RIPPLE_LIFETIME,
  HIT_RIPPLE_MAX_RADIUS,
  RIPPLE_LIFETIME,
  RIPPLE_MAX_RADIUS,
  WATER_LEVEL,
} from '../config'

export type RippleVariant = 'normal' | 'hit'

export type RippleProps = {
  id: number
  x: number
  z: number
  variant: RippleVariant
  onDone: (id: number) => void
}

/** easeOut: 立ち上がりは速く、徐々に減速して広がる。 */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * 着水位置に広がる輪。拡大しながら透明になり、寿命が尽きたら onDone で消える。
 * hit 版（バーに当たった）はやや小さく金色に光る。
 */
export function Ripple({ id, x, z, variant, onDone }: RippleProps) {
  const ref = useRef<Mesh>(null)
  const age = useRef(0)

  const lifetime = variant === 'hit' ? HIT_RIPPLE_LIFETIME : RIPPLE_LIFETIME
  const maxRadius = variant === 'hit' ? HIT_RIPPLE_MAX_RADIUS : RIPPLE_MAX_RADIUS
  const color = variant === 'hit' ? '#ffe39a' : '#bfe9ff'

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return

    age.current += delta
    const t = age.current / lifetime
    if (t >= 1) {
      onDone(id)
      return
    }

    const radius = easeOut(t) * maxRadius
    mesh.scale.set(radius, radius, radius)
    const material = mesh.material as MeshBasicMaterial
    material.opacity = (1 - t) * (variant === 'hit' ? 0.9 : 0.6)
  })

  return (
    <mesh
      ref={ref}
      position={[x, WATER_LEVEL + 0.01, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[0.001, 0.001, 0.001]}
    >
      {/* 単位リング（内外半径）。scale で実半径を表現する。 */}
      <ringGeometry args={[0.78, 1.0, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
    </mesh>
  )
}
