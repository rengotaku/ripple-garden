import { POND_HALF, WATER_LEVEL } from '../config'

/**
 * 水面となる平らな板。Phase 1 ではシェーダー無しのシンプルな半透明マテリアル。
 * （反射/屈折/波の干渉は Phase 2 以降のスコープ）
 */
export function WaterPlane() {
  return (
    <mesh
      position={[0, WATER_LEVEL, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[POND_HALF * 2, POND_HALF * 2, 1, 1]} />
      <meshStandardMaterial
        color="#1b3a52"
        roughness={0.15}
        metalness={0.5}
        transparent
        opacity={0.92}
      />
    </mesh>
  )
}
