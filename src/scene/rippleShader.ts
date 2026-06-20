/** ソフトな同心円の波紋シェーダ。中心から広がる主リングと、追従する弱いリング。 */

export const rippleVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const rippleFrag = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uProgress; // 0..1
  uniform float uStrength;
  varying vec2 vUv;

  void main() {
    float d = length(vUv - 0.5) * 2.0; // 中心 0 → 縁 1
    if (d > 1.0) discard;

    float p = uProgress;
    // 主リング（半径 p に細い帯）
    float ring = smoothstep(0.10, 0.0, abs(d - p));
    // 追従する弱いリング（内側）
    ring += 0.45 * smoothstep(0.07, 0.0, abs(d - p + 0.16));
    ring += 0.22 * smoothstep(0.05, 0.0, abs(d - p + 0.30));

    float fade = 1.0 - p;          // 時間で消える
    float edge = smoothstep(1.0, 0.55, d); // 縁でなめらかに消す
    float a = clamp(ring * fade * edge * uStrength, 0.0, 0.85);

    // 通常αブレンド（加算だと多数重なって Bloom が白飛びするため）。
    gl_FragColor = vec4(uColor, a);
  }
`
