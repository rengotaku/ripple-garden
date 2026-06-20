import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, type DirectionalLight, type Group, type Mesh } from 'three'
import { POND_HALF } from '../config'
import { quality } from '../util/quality'

/**
 * 音板（原点）を中心に、太陽・月・惑星が周回するミニ太陽系。
 * 太陽は多層のコロナで「太陽らしい」発光に。ディレクショナルライトは太陽に追従し、
 * 太陽が高いほど明るい（昼夜のうつろい）。
 */
const ORBIT_SPEED = 0.06
const SUN_R = 14
const MOON_R = 9
const TILT = 0.5

type Planet = {
  r: number
  speed: number
  size: number
  color: string
  tilt: number
  phase: number
}
const PLANETS: Planet[] = [
  { r: 5.5, speed: 0.45, size: 0.28, color: '#c98a6f', tilt: 0.25, phase: 0.0 },
  { r: 7.2, speed: 0.34, size: 0.42, color: '#6fa8c9', tilt: 0.55, phase: 1.3 },
  { r: 9.4, speed: 0.25, size: 0.62, color: '#c9b07f', tilt: 0.4, phase: 2.6 },
  { r: 11.5, speed: 0.18, size: 0.4, color: '#9f8ad8', tilt: 0.7, phase: 4.1 },
  { r: 13.5, speed: 0.13, size: 0.55, color: '#7fc9a0', tilt: 0.32, phase: 5.4 },
]

// 音板（原点＝地球の位置）を中心に周回する。
function orbit(r: number, a: number, tilt: number): [number, number, number] {
  return [Math.cos(a) * r, Math.sin(a) * r * Math.cos(tilt), Math.sin(a) * r * Math.sin(tilt)]
}

export function Celestial() {
  const sun = useRef<Group>(null)
  const moon = useRef<Mesh>(null)
  const light = useRef<DirectionalLight>(null)
  const planetRefs = useRef<(Mesh | null)[]>([])

  const t0 = useMemo(() => PLANETS.map((p) => p.phase), [])

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const a = time * ORBIT_SPEED

    const [sx, sy, sz] = orbit(SUN_R, a, TILT)
    if (sun.current) sun.current.position.set(sx, sy, sz)
    const [mx, my, mz] = orbit(MOON_R, a + Math.PI, TILT)
    if (moon.current) moon.current.position.set(mx, my, mz)

    for (let i = 0; i < PLANETS.length; i++) {
      const p = PLANETS[i]
      const [px, py, pz] = orbit(p.r, time * p.speed + t0[i], p.tilt)
      const m = planetRefs.current[i]
      if (m) m.position.set(px, py, pz)
    }

    if (light.current) {
      const sunUp = sy > 0
      light.current.position.set(sunUp ? sx : mx, Math.max(3, sunUp ? sy : my), (sunUp ? sz : mz) + 4)
      const h = Math.max(0, sy / SUN_R)
      light.current.intensity = 0.4 + h * 0.95
      light.current.color.setHex(sunUp ? 0xfff1d6 : 0xbfd0ff)
    }
  })

  return (
    <>
      <directionalLight
        ref={light}
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

      {/* 太陽：芯＋多層コロナで太陽らしい発光に。 */}
      <group ref={sun}>
        <mesh>
          <sphereGeometry args={[1.0, 32, 32]} />
          <meshBasicMaterial color="#fff6d0" toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[1.5, 24, 24]} />
          <meshBasicMaterial color="#ffd86a" transparent opacity={0.4} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[2.2, 24, 24]} />
          <meshBasicMaterial color="#ffa83a" transparent opacity={0.2} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[3.2, 20, 20]} />
          <meshBasicMaterial color="#ff8a2a" transparent opacity={0.08} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
        </mesh>
        <pointLight color="#ffdca0" intensity={22} distance={50} decay={1.3} />
      </group>

      {/* 月 */}
      <mesh ref={moon}>
        <sphereGeometry args={[0.95, 32, 32]} />
        <meshStandardMaterial color="#cfd8e6" emissive="#3a4a66" emissiveIntensity={0.4} roughness={1} />
      </mesh>

      {/* 惑星 */}
      {PLANETS.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            planetRefs.current[i] = el
          }}
        >
          <sphereGeometry args={[p.size, 24, 24]} />
          <meshStandardMaterial color={p.color} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
    </>
  )
}
