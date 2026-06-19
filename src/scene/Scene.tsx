import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping } from 'three'
import { POND_HALF, SIM_RES } from '../config'
import { createWaterField } from '../water/waterField'
import { WaterPlane } from '../water/WaterPlane'
import { WaterSim } from '../water/WaterSim'
import { RainSystem } from './RainSystem'
import { Effects } from './Effects'

/**
 * シーン全体。少し見下ろすカメラ、控えめな環境光＋ディレクショナルライト（影付き）、
 * オフラインでも効く Lightformer ベースの環境マップ（金属面の映り込み用）、
 * 水面、放置で動く水滴・波紋・鉄琴バー、そして後処理（Bloom/Vignette）。
 */
export function Scene() {
  const field = useMemo(() => createWaterField(SIM_RES), [])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 6, 9], fov: 45 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
    >
      <color attach="background" args={['#0a131d']} />
      <fog attach="fog" args={['#0a131d', 13, 30]} />

      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 9, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-camera-left={-POND_HALF}
        shadow-camera-right={POND_HALF}
        shadow-camera-top={POND_HALF}
        shadow-camera-bottom={-POND_HALF}
      />

      {/* オフラインでも効く環境マップ。金属の水面/バーへ柔らかな映り込みを与える。 */}
      <Environment resolution={256}>
        <color attach="background" args={['#0a131d']} />
        <Lightformer intensity={1.4} position={[0, 4, -3]} scale={[8, 4, 1]} color="#3a6ea5" />
        <Lightformer intensity={0.7} position={[-4, 2, 2]} scale={[3, 3, 1]} color="#9fd8ff" />
        <Lightformer intensity={0.5} position={[4, 2, 2]} scale={[3, 3, 1]} color="#ffe39a" />
      </Environment>

      <WaterSim field={field} />
      <WaterPlane field={field} />
      <RainSystem field={field} />

      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0, 0]}
      />

      <Effects />
    </Canvas>
  )
}
