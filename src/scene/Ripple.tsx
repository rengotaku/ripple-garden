import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  type BufferGeometry,
  type Mesh,
  type ShaderMaterial,
} from 'three'
import {
  HIT_RIPPLE_LIFETIME,
  HIT_RIPPLE_MAX_RADIUS,
  RIPPLE_LIFETIME,
  RIPPLE_MAX_RADIUS,
} from '../config'

export type RippleVariant = 'normal' | 'hit'

export type RippleProps = {
  id: number
  x: number
  z: number
  y: number
  variant: RippleVariant
  geometry: BufferGeometry
  material: ShaderMaterial
  onDone: (id: number) => void
}

const NORMAL_COLOR = new Color('#aee0ff')
const HIT_COLOR = new Color('#ffe39a')

/**
 * 着水の波紋。ハードなリングではなく、ソフトに広がる同心円の波をシェーダで描く
 * （加算合成・トーンマッピング無効で水面に光として乗る）。マテリアル/ジオメトリは
 * 全波紋で共有し、onBeforeRender で各インスタンスの進行度・色をその描画直前に注入する。
 */
export function Ripple({
  id,
  x,
  z,
  y,
  variant,
  geometry,
  material,
  onDone,
}: RippleProps) {
  const ref = useRef<Mesh>(null)
  const age = useRef(0)
  const done = useRef(false)

  const lifetime = variant === 'hit' ? HIT_RIPPLE_LIFETIME : RIPPLE_LIFETIME
  const maxRadius = variant === 'hit' ? HIT_RIPPLE_MAX_RADIUS : RIPPLE_MAX_RADIUS
  const color = variant === 'hit' ? HIT_COLOR : NORMAL_COLOR
  const strength = variant === 'hit' ? 1.0 : 0.55
  const diameter = maxRadius * 2

  useFrame((_, delta) => {
    if (done.current) return
    age.current += delta
    if (age.current / lifetime >= 1) {
      done.current = true
      onDone(id)
    }
  })

  return (
    <mesh
      ref={ref}
      position={[x, y + 0.012, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[diameter, diameter, 1]}
      geometry={geometry}
      material={material}
      onBeforeRender={() => {
        const u = material.uniforms
        u.uProgress.value = Math.min(1, age.current / lifetime)
        u.uColor.value = color
        u.uStrength.value = strength
      }}
    />
  )
}
