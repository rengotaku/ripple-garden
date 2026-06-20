import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type MeshStandardMaterial } from 'three'
import type { BarDef } from '../config'

export type XylophoneBarProps = {
  bar: BarDef
  /** このバーへ最後に着水した時刻（clock.elapsedTime）。発光の減衰に使う。 */
  lastHitRef: MutableRefObject<number>
}

const GLOW_COLOR = new Color('#ffeeb0')
const GLOW_DECAY = 4.5 // 秒で減衰（短い閃光に）

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
    // Bloom 不採用のため発光自体で命中を見せる（多数同時でも白飛びしない）。
    mat.emissiveIntensity = glow * 1.5
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
