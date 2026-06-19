import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { DROP_START_Y, GRAVITY, WATER_LEVEL } from '../config'

export type DropProps = {
  id: number
  x: number
  z: number
  onLand: (id: number, x: number, z: number) => void
}

/**
 * 1 滴の水滴。重力で落下し、水面に着いたら onLand を 1 度だけ呼ぶ。
 * 位置は ref で直接更新し、毎フレームの React 再レンダリングを避ける。
 */
export function Drop({ id, x, z, onLand }: DropProps) {
  const ref = useRef<Mesh>(null)
  const velocity = useRef(0)
  const landed = useRef(false)

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh || landed.current) return

    velocity.current += GRAVITY * delta
    mesh.position.y -= velocity.current * delta

    if (mesh.position.y <= WATER_LEVEL) {
      landed.current = true
      onLand(id, x, z)
    }
  })

  return (
    <mesh ref={ref} position={[x, DROP_START_Y, z]} castShadow>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial color="#9fd8ff" roughness={0.1} metalness={0.1} />
    </mesh>
  )
}
