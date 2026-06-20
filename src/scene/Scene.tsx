import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, Sparkles } from '@react-three/drei'
import { ACESFilmicToneMapping } from 'three'
import { POND_HALF } from '../config'
import { isMobile, quality } from '../util/quality'
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
  const field = useMemo(() => createWaterField(quality.simRes), [])

  return (
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      camera={{ position: [0, 6, 9], fov: 45 }}
      gl={{ antialias: !isMobile, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
    >
      <color attach="background" args={['#0a131d']} />
      <fog attach="fog" args={['#0a131d', 13, 30]} />

      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 9, 4]}
        intensity={1.1}
        castShadow={quality.shadows}
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
        {/* 月明かり: 水面をうっすら照らす光源。 */}
        <Lightformer form="circle" intensity={2.0} position={[2, 7, -6]} scale={[3.5, 3.5, 1]} color="#e6f1ff" />
        <Lightformer intensity={1.2} position={[0, 4, -3]} scale={[10, 4, 1]} color="#2f5e8f" />
        <Lightformer intensity={0.6} position={[-5, 2, 2]} scale={[3, 3, 1]} color="#9fd8ff" />
        <Lightformer intensity={0.5} position={[5, 2, 2]} scale={[3, 3, 1]} color="#ffe39a" />
      </Environment>

      {/* 空高くに浮かぶ月（Bloom で柔らかく光る）。 */}
      <mesh position={[7, 13, -14]}>
        <sphereGeometry args={[0.82, 32, 32]} />
        <meshBasicMaterial color="#eaf3ff" toneMapped={false} />
      </mesh>

      <WaterSim field={field} />
      <WaterPlane field={field} />
      <RainSystem field={field} />

      {/* 水面の上に漂う微かな霧の粒子。premium な空気感を足す。 */}
      <Sparkles
        count={quality.sparkles}
        scale={[POND_HALF * 2, 3.5, POND_HALF * 2]}
        position={[0, 1.4, 0]}
        size={2.4}
        speed={0.25}
        opacity={0.45}
        color="#bfe9ff"
      />

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.05}
        autoRotate
        autoRotateSpeed={0.28}
        minDistance={5}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0, 0]}
      />

      <Effects />
    </Canvas>
  )
}
