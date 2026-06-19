import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { BufferGeometry, Material, Mesh } from 'three'
import { DROP_START_Y, GRAVITY } from '../config'

export type DropProps = {
  id: number
  x: number
  z: number
  /** 着地する高さ（水面、またはバー上ならバー天面）。 */
  landY: number
  geometry: BufferGeometry
  material: Material
  onLand: (id: number, x: number, z: number) => void
}

/**
 * 1 滴の水滴。重力で落下し、着地面（水面 or バー天面）に着いたら onLand を 1 度だけ呼ぶ。
 * 落下中は速度に応じて縦に伸びた雫の形になる（モーションストレッチ）。
 * 位置・スケールは ref で直接更新し、毎フレームの React 再レンダリングを避ける。
 */
export function Drop({ id, x, z, landY, geometry, material, onLand }: DropProps) {
  const ref = useRef<Mesh>(null)
  const velocity = useRef(0)
  const landed = useRef(false)

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh || landed.current) return

    velocity.current += GRAVITY * delta
    mesh.position.y -= velocity.current * delta

    // 速度が上がるほど少し縦長の雫に（やり過ぎない程度）。
    const stretch = Math.min(1.5, 1 + velocity.current * 0.045)
    mesh.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch))

    if (mesh.position.y <= landY) {
      landed.current = true
      onLand(id, x, z)
    }
  })

  return (
    <mesh ref={ref} position={[x, DROP_START_Y, z]} geometry={geometry} material={material} castShadow />
  )
}
