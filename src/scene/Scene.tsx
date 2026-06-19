import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { POND_HALF } from '../config'
import { WaterPlane } from './WaterPlane'
import { RainSystem } from './RainSystem'

/**
 * Phase 1 のシーン全体。少し見下ろすカメラ、環境光＋ディレクショナルライト（影付き）、
 * 水面、放置で動く水滴・波紋・鉄琴バー。OrbitControls で視点を回せる。
 */
export function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 6, 9], fov: 45 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0b1622']} />
      <fog attach="fog" args={['#0b1622', 14, 28]} />

      <ambientLight intensity={0.45} />
      <directionalLight
        position={[5, 9, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-POND_HALF}
        shadow-camera-right={POND_HALF}
        shadow-camera-top={POND_HALF}
        shadow-camera-bottom={-POND_HALF}
      />

      <WaterPlane />
      <RainSystem />

      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0, 0]}
      />
    </Canvas>
  )
}
