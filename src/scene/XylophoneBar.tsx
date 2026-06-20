import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { Color, type MeshPhysicalMaterial } from 'three'
import type { BarDef } from '../config'

export type XylophoneBarProps = {
  bar: BarDef
  /** このバーへ最後に着水した時刻（clock.elapsedTime）。発光の減衰に使う。 */
  lastHitRef: MutableRefObject<number>
}

const GLOW_COLOR = new Color('#ffeeb0')
const GLOW_DECAY = 4.5 // 秒で減衰（短い閃光に）

/**
 * マリンバ風の鉄琴バー 1 本。角を丸めた箱（RoundedBox）＋マットな木質＋うっすら艶の
 * マテリアルにして、カクカクしたポリゴン感を抑える。命中時は emissive が立ち上がり徐々に収まる。
 */
export function XylophoneBar({ bar, lastHitRef }: XylophoneBarProps) {
  const matRef = useRef<MeshPhysicalMaterial>(null)
  const baseColor = useMemo(() => new Color(bar.color), [bar.color])
  // 角の丸み。板の高さに対して控えめに（潰れない範囲で）。
  const radius = Math.min(0.06, bar.size[1] * 0.45)

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
    <RoundedBox
      args={[...bar.size]}
      radius={radius}
      smoothness={4}
      position={[...bar.position]}
      rotation={[0, bar.rotationY, 0]}
      castShadow
      receiveShadow
    >
      <meshPhysicalMaterial
        ref={matRef}
        color={baseColor}
        roughness={0.16}
        metalness={0}
        transmission={0.92}
        thickness={0.8}
        ior={1.35}
        clearcoat={0.7}
        clearcoatRoughness={0.25}
        envMapIntensity={0.8}
        transparent
      />
    </RoundedBox>
  )
}
