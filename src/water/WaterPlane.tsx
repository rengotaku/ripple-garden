import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  DoubleSide,
  type IUniform,
  MeshStandardMaterial,
  Vector2,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import {
  POND_HALF,
  SIM_RES,
  WATER_DISP_SCALE,
  WATER_LEVEL,
  WATER_NORMAL_STRENGTH,
} from '../config'
import type { WaterField } from './waterField'

/**
 * 高さ場テクスチャから頂点を変位させ、勾配から法線を再計算する水面。
 * MeshStandardMaterial を onBeforeCompile でパッチし、PBR の映り込み（環境マップ）と
 * Bloom/トーンマッピングにそのまま乗せる。これで「水面そのものが波打つ」表現になる。
 */

const PLANE_SIZE = POND_HALF * 2
const SEGMENTS = 200

export function WaterPlane({ field }: { field: WaterField }) {
  const uniforms = useRef<{ [k: string]: IUniform }>({
    uHeight: { value: null as Texture | null },
    uTexel: { value: new Vector2(1 / SIM_RES, 1 / SIM_RES) },
    uDisp: { value: WATER_DISP_SCALE },
    uNormalStrength: { value: WATER_NORMAL_STRENGTH },
  })

  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      // 拡散主体の水面（鏡面反射ほぼ無し）。どれだけ波立っても眩しい反射を出さないので
      // 白飛びしない。さざ波は頂点変位＋ディレクショナルライトの陰影で見せる。
      color: new Color('#123349'),
      roughness: 0.6,
      metalness: 0.0,
      envMapIntensity: 0.2,
      side: DoubleSide,
      transparent: true,
      opacity: 0.95,
    })

    mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uHeight = uniforms.current.uHeight
      shader.uniforms.uTexel = uniforms.current.uTexel
      shader.uniforms.uDisp = uniforms.current.uDisp
      shader.uniforms.uNormalStrength = uniforms.current.uNormalStrength

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform sampler2D uHeight;
          uniform vec2 uTexel;
          uniform float uDisp;
          uniform float uNormalStrength;
          float sampleH(vec2 uv) { return texture2D(uHeight, uv).r; }
          `,
        )
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
          vec2 simUv = position.xy / ${PLANE_SIZE.toFixed(1)} + 0.5;
          float hL = sampleH(simUv + vec2(-uTexel.x, 0.0));
          float hR = sampleH(simUv + vec2( uTexel.x, 0.0));
          float hD = sampleH(simUv + vec2(0.0, -uTexel.y));
          float hU = sampleH(simUv + vec2(0.0,  uTexel.y));
          vec3 objectNormal = normalize(vec3(
            (hL - hR) * uNormalStrength,
            (hD - hU) * uNormalStrength,
            1.0
          ));
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          float h = sampleH(simUv);
          vec3 transformed = vec3(position);
          transformed.z += h * uDisp;
          `,
        )
    }
    return mat
  }, [])

  // JSX の prop として渡すマテリアルは R3F の管理外なので、自前で破棄する。
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    uniforms.current.uHeight.value = field.texture
  })

  return (
    <mesh
      position={[0, WATER_LEVEL, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      material={material}
    >
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, SEGMENTS, SEGMENTS]} />
    </mesh>
  )
}
