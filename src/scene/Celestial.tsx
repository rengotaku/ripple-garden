import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, type DirectionalLight, type Group, type Mesh } from 'three'
import { POND_HALF } from '../config'
import { settings } from '../state/settings'
import { quality } from '../util/quality'

/**
 * 音板（原点）を中心に、太陽・月・惑星が周回するミニ太陽系。
 * 太陽は多層のコロナで「太陽らしい」発光に。ディレクショナルライトは太陽に追従し、
 * 太陽が高いほど明るい（昼夜のうつろい）。
 */
const ORBIT_SPEED = 0.06
/** 落下速度 0..1 → 天体の流れる速さの倍率（0.5 で等倍。遅くすると空もゆっくり）。 */
function fallToSkyRate(v: number): number {
  return 0.2 + Math.max(0, Math.min(1, v)) * 1.6 // v=0:×0.2 / 0.5:×1 / 1:×1.8
}
const SUN_R = 20
const MOON_R = 14
const TILT = 0.5

type Planet = {
  r: number
  speed: number
  size: number
  color: string
  tilt: number
  phase: number
  /** 環（土星）。色は環の色。 */
  ring?: string
  /** 自転の傾き表現用のメッシュ傾き。 */
  axis?: number
}
const PLANETS: Planet[] = [
  { r: 11, speed: 0.45, size: 0.34, color: '#b8794f', tilt: 0.25, phase: 0.0, axis: 0.1 },
  { r: 15, speed: 0.34, size: 0.6, color: '#4f8fc9', tilt: 0.55, phase: 1.3, axis: 0.4 },
  { r: 19, speed: 0.25, size: 0.86, color: '#e0c98a', tilt: 0.4, phase: 2.6, ring: '#e6d6a8', axis: 0.47 },
  { r: 23, speed: 0.18, size: 0.5, color: '#9f7fd8', tilt: 0.7, phase: 4.1, axis: 0.9 },
  { r: 27, speed: 0.13, size: 0.68, color: '#5fb890', tilt: 0.32, phase: 5.4, axis: 0.2 },
]

// 音板（原点＝地球の位置）を中心に周回する。
function orbit(r: number, a: number, tilt: number): [number, number, number] {
  return [Math.cos(a) * r, Math.sin(a) * r * Math.cos(tilt), Math.sin(a) * r * Math.sin(tilt)]
}

export function Celestial() {
  const sun = useRef<Group>(null)
  const moon = useRef<Mesh>(null)
  const light = useRef<DirectionalLight>(null)
  const planetRefs = useRef<(Group | null)[]>([])
  // 天体の「流れた時間」を累積する。落下速度に応じてフレームごとに進める速さを変える。
  const skyTime = useRef(0)

  const t0 = useMemo(() => PLANETS.map((p) => p.phase), [])

  useFrame((_, delta) => {
    skyTime.current += delta * fallToSkyRate(settings.fallSpeed)
    const time = skyTime.current
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

      {/* 惑星（土星は環つき。各惑星は色・自転傾き・環で見分けがつく） */}
      {PLANETS.map((p, i) => (
        <group
          key={i}
          ref={(el) => {
            planetRefs.current[i] = el
          }}
          rotation={[p.axis ?? 0, 0, 0]}
        >
          <mesh>
            <sphereGeometry args={[p.size, 24, 24]} />
            <meshStandardMaterial color={p.color} roughness={0.85} metalness={0.1} />
          </mesh>
          {p.ring && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[p.size * 1.45, p.size * 2.3, 56]} />
              <meshBasicMaterial
                color={p.ring}
                side={DoubleSide}
                transparent
                opacity={0.6}
                toneMapped={false}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      ))}
    </>
  )
}
