import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type MeshStandardMaterial } from 'three'
import type { BarDef } from '../config'

export type XylophoneBarProps = {
  bar: BarDef
  /** このバーへ最後に着水した時刻（clock.elapsedTime）。発光の減衰に使う。 */
  lastHitRef: MutableRefObject<number>
}

const GLOW_COLOR = new Color('#fff1c2')
const GLOW_DECAY = 2.5 // 秒で減衰

/**
 * マリンバ風の鉄琴バー 1 本。着水のタイミングからの経過時間に応じて
 * emissive が立ち上がり徐々に収まる（Bloom で柔らかく光る）。
 */
export function XylophoneBar({ bar, lastHitRef }: XylophoneBarProps) {
  const matRef = useRef<MeshStandardMaterial>(null)
  const baseColor = useMemo(() => new Color(bar.color), [bar.color])

  useFrame((state) => {
    const mat = matRef.current
    if (!mat) return
    const since = state.clock.elapsedTime - lastHitRef.current
    const glow = Math.max(0, 1 - since * GLOW_DECAY)
    mat.emissive.copy(GLOW_COLOR).multiplyScalar(glow)
    mat.emissiveIntensity = glow * 2.2
  })

  return (
    <mesh position={[...bar.position]} castShadow receiveShadow>
      <boxGeometry args={[...bar.size]} />
      <meshStandardMaterial
        ref={matRef}
        color={baseColor}
        roughness={0.3}
        metalness={0.65}
      />
    </mesh>
  )
}
