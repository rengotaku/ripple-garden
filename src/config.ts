/**
 * Phase 1 シーン全体の調整パラメータ。
 * マジックナンバーを散らさず、ここに集約する。
 */

/** 水面の高さ（ワールド Y）。水面は y=0 の水平面。 */
export const WATER_LEVEL = 0

/** 水面（正方形）の一辺の半分の長さ。落下範囲もこの矩形に収める。 */
export const POND_HALF = 5

/** 水滴の落下開始高さ。 */
export const DROP_START_Y = 6

/** 重力加速度（units/sec^2）。見栄え優先の値。 */
export const GRAVITY = 9.0

/** 水滴生成間隔のゆらぎ（秒）。min〜max の一様乱数で次の滴までの間隔を決める。
 *  しっかり雨が降っていて、バーにも頻繁に当たって音が鳴るくらいの密度。 */
export const SPAWN_INTERVAL_MIN = 0.04
export const SPAWN_INTERVAL_MAX = 0.16

/** 1 回の生成で同時に落とす滴の数（ゆらぎを持たせて雨らしく）。 */
export const SPAWN_BURST_MAX = 2

/** 波紋の寿命（秒）と最大半径。 */
export const RIPPLE_LIFETIME = 1.8
export const RIPPLE_MAX_RADIUS = 1.1

/** 鉄琴バーに当たったときの波紋（光る方）の寿命と最大半径。 */
export const HIT_RIPPLE_LIFETIME = 1.4
export const HIT_RIPPLE_MAX_RADIUS = 0.9

/** ===== 水面シミュレーション（GPU 波動方程式） ===== */

/** シミュレーション用テクスチャ解像度（正方）。 */
export const SIM_RES = 256

/** 1 フレームで注入できる着水点の最大数。 */
export const MAX_IMPACTS = 12

/** 波の減衰係数（1 に近いほど長く揺れる）。速度積分形では 0.99〜0.997 が安定。 */
export const WAVE_DAMPING = 0.994

/** 高さ → 頂点変位のスケール（ワールド単位）。 */
export const WATER_DISP_SCALE = 0.2

/** 高さ勾配 → 法線の強さ（映り込みの歪み量）。波が光を拾うよう強めに。 */
export const WATER_NORMAL_STRENGTH = 2.4

/** 着水時に水面へ与える波の強さ（通常／バー命中）。雨が密なので 1 滴は控えめに。 */
export const IMPACT_STRENGTH = 0.28
export const IMPACT_STRENGTH_HIT = 0.5

/** 自動スライドモードでのバー列の振れ幅（X/Z）。池の中をゆっくり巡る。
 *  X はバー列が広いと池からはみ出すので控えめ、奥行 Z 方向を主に動かす。 */
export const SLIDE_AMP_X = 0.6
export const SLIDE_AMP_Z = 2.6

/**
 * 鳴る音域（ペンタトニック ＝ C メジャー系）。
 * ★音の幅を変えたいときはこの配列を編集するだけ★ 音を足す/減らすと、
 * バーの本数・色・横位置・雨の範囲はすべて自動で調整される。
 * どの順で当たっても不協和になりにくいペンタトニックなので、好きに広げてよい。
 */
export const BAR_NOTES = [
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
  'C6', 'D6', 'E6',
] as const

const BAR_COUNT = BAR_NOTES.length
/** バー 1 本ぶんの間隔。 */
const BAR_SPACING = 0.7
/** バー列の横幅（本数から自動計算）。 */
export const BAR_SPREAD = (BAR_COUNT - 1) * BAR_SPACING

/**
 * 雨を降らせる範囲（バー付近に集中させる）。バー列を覆う矩形＋少しの余白。
 * 横幅はバー列に合わせて自動。自動スライド時はこの中心がバー列と一緒に動く。
 */
export const RAIN_FOCUS_X_HALF = BAR_SPREAD / 2 + 0.5
export const RAIN_FOCUS_Z_CENTER = 0.4
export const RAIN_FOCUS_Z_HALF = 1.7

/** ワールド座標 (x,z) を水面テクスチャの uv に変換する。 */
export function worldToUv(x: number, z: number): [number, number] {
  return [x / (POND_HALF * 2) + 0.5, z / (POND_HALF * 2) + 0.5]
}

/** バー 1 本分の定義。 */
export type BarDef = {
  id: number
  /** 中心位置 [x, y, z] */
  position: readonly [number, number, number]
  /** 寸法 [幅(X)=バー厚, 高さ(Y), 奥行(Z)=バー長] */
  size: readonly [number, number, number]
  /** 当たったときに鳴る音。 */
  note: string
  /** バーの基調色。 */
  color: string
}

/**
 * マリンバ風に横一列へ並べた鉄琴バー。低音(左)ほど長く（奥行 Z 大）暖色、
 * 高音(右)ほど短く寒色〜紫にして、視覚的にも音階が分かるようにする。
 * 本数・横位置・色は BAR_NOTES から自動生成されるので、音域を変えても手当て不要。
 */
export const BARS: readonly BarDef[] = BAR_NOTES.map((note, i) => {
  const frac = BAR_COUNT > 1 ? i / (BAR_COUNT - 1) : 0
  const x = -BAR_SPREAD / 2 + BAR_SPACING * i
  // 低音(左)ほど長く、高音(右)ほど短く。
  const depth = 1.25 - 0.7 * frac
  // 色相を暖色(低音)→寒色→紫(高音)へ。THREE.Color は hsl() 文字列を解釈できる。
  const hue = Math.round(18 + 267 * frac)
  return {
    id: i,
    position: [x, WATER_LEVEL + 0.09, 0.4] as const,
    size: [BAR_SPACING * 0.82, 0.18, depth] as const,
    note,
    color: `hsl(${hue}, 55%, 62%)`,
  }
})
