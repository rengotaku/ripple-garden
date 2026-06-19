import { useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type MeshStandardMaterial } from 'three'
import { BAR } from '../config'

export type XylophoneBarProps = {
  /** 最後にバーへ着水した時刻（clock.elapsedTime）。発光の減衰に使う。 */
  lastHitRef: MutableRefObject<number>
}

const BASE_COLOR = new Color('#6fb3c9')
const GLOW_COLOR = new Color('#fff1c2')
const GLOW_DECAY = 2.5 // 秒で減衰

/**
 * 水面に置いた鉄琴バー（細長い箱）。
 * 着水したタイミングからの経過時間に応じて emissive が立ち上がり、徐々に収まる。
 */
export function XylophoneBar({ lastHitRef }: XylophoneBarProps) {
  const matRef = useRef<MeshStandardMaterial>(null)

  useFrame((state) => {
    const mat = matRef.current
    if (!mat) return
    const since = state.clock.elapsedTime - lastHitRef.current
    const glow = Math.max(0, 1 - since * GLOW_DECAY)
    mat.emissive.copy(GLOW_COLOR).multiplyScalar(glow)
    mat.emissiveIntensity = glow * 2
  })

  return (
    <mesh position={[...BAR.position]} castShadow receiveShadow>
      <boxGeometry args={[...BAR.size]} />
      <meshStandardMaterial
        ref={matRef}
        color={BASE_COLOR}
        roughness={0.35}
        metalness={0.6}
      />
    </mesh>
  )
}
