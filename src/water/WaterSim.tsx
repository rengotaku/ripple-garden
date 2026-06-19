import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import {
  ClampToEdgeWrapping,
  HalfFloatType,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Mesh,
} from 'three'
import { MAX_IMPACTS, WAVE_DAMPING } from '../config'
import type { WaterField } from './waterField'

/**
 * 高さ場の波動方程式を GPU で解く（ping-pong FBO）。
 * チャンネル: R=高さ, G=速度。速度積分形（安定）。着水点は cos バンプで注入し、
 * 縁では減衰させて静かな池のように波が淵で消えるようにする。
 *
 * 研究知見の反映:
 * - サンプリングは NearestFilter（LINEAR は有限差分ステンシルを壊す）
 * - HalfFloat / RGBA / ClampToEdge
 * - 速度積分形 info.g += (avg - info.r)*2; info.g *= damping; info.r += info.g
 */

const simVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const simFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uPrev;
  uniform vec2 uTexel;
  uniform float uDamping;
  uniform float uInit;
  uniform int uImpactCount;
  uniform vec3 uImpacts[${MAX_IMPACTS}];
  uniform float uImpactRadius;
  varying vec2 vUv;

  void main() {
    if (uInit > 0.5) { gl_FragColor = vec4(0.0); return; }

    vec4 info = texture2D(uPrev, vUv);
    float avg = (
      texture2D(uPrev, vUv + vec2(-uTexel.x, 0.0)).r +
      texture2D(uPrev, vUv + vec2( uTexel.x, 0.0)).r +
      texture2D(uPrev, vUv + vec2(0.0, -uTexel.y)).r +
      texture2D(uPrev, vUv + vec2(0.0,  uTexel.y)).r
    ) * 0.25;

    info.g += (avg - info.r) * 2.0;
    info.g *= uDamping;
    info.r += info.g;

    // 着水点の注入（なめらかな cos バンプ）
    for (int i = 0; i < ${MAX_IMPACTS}; i++) {
      if (i >= uImpactCount) break;
      vec3 imp = uImpacts[i];
      float d = length(vUv - imp.xy);
      float bump = max(0.0, 1.0 - d / uImpactRadius);
      bump = 0.5 - cos(bump * 3.14159265) * 0.5;
      info.r += bump * imp.z;
    }

    // 縁で波を吸収（淵での反射を抑え、静かな池に）
    float edge =
      smoothstep(0.0, 0.06, vUv.x) * smoothstep(0.0, 0.06, 1.0 - vUv.x) *
      smoothstep(0.0, 0.06, vUv.y) * smoothstep(0.0, 0.06, 1.0 - vUv.y);
    info.rg *= mix(0.9, 1.0, edge);

    gl_FragColor = info;
  }
`

export function WaterSim({ field }: { field: WaterField }) {
  const gl = useThree((s) => s.gl)
  const res = field.resolution

  const fboOpts = {
    width: res,
    height: res,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    format: RGBAFormat,
    type: HalfFloatType,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  }
  const fboA = useFBO(fboOpts)
  const fboB = useFBO(fboOpts)
  const targets = useRef([fboA, fboB])
  const readIdx = useRef(0)
  const initFrames = useRef(2)

  const sim = useMemo(() => {
    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const material = new ShaderMaterial({
      vertexShader: simVert,
      fragmentShader: simFrag,
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new Vector2(1 / res, 1 / res) },
        uDamping: { value: WAVE_DAMPING },
        uInit: { value: 1 },
        uImpactCount: { value: 0 },
        uImpacts: {
          value: Array.from({ length: MAX_IMPACTS }, () => new Vector3()),
        },
        uImpactRadius: { value: 0.035 },
      },
    })
    const quad = new Mesh(new PlaneGeometry(2, 2), material)
    scene.add(quad)
    return { scene, camera, material, quad }
  }, [res])

  // マウント時に両バッファをゼロクリア（未初期化テクスチャの NaN を防ぐ）
  useEffect(() => {
    const prevRT = gl.getRenderTarget()
    for (const t of targets.current) {
      gl.setRenderTarget(t)
      gl.setClearColor(0x000000, 0)
      gl.clear()
    }
    gl.setRenderTarget(prevRT)
  }, [gl])

  useEffect(() => {
    const geom = sim.quad.geometry
    const mat = sim.material
    return () => {
      geom.dispose()
      mat.dispose()
    }
  }, [sim])

  useFrame(() => {
    const read = targets.current[readIdx.current]
    const write = targets.current[1 - readIdx.current]
    const u = sim.material.uniforms

    u.uPrev.value = read.texture
    u.uInit.value = initFrames.current > 0 ? 1 : 0

    const impacts = field.impacts
    const arr = u.uImpacts.value as Vector3[]
    const n = Math.min(impacts.length, MAX_IMPACTS)
    for (let i = 0; i < n; i++) {
      arr[i].set(impacts[i].u, impacts[i].v, impacts[i].strength)
    }
    u.uImpactCount.value = n

    const prevRT = gl.getRenderTarget()
    gl.setRenderTarget(write)
    gl.render(sim.scene, sim.camera)
    gl.setRenderTarget(prevRT)

    field.texture = write.texture
    readIdx.current = 1 - readIdx.current
    field.impacts.length = 0
    if (initFrames.current > 0) initFrames.current--
  })

  return null
}
