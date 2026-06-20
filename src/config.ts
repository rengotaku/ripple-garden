/**
 * Phase 1 シーン全体の調整パラメータ。
 * マジックナンバーを散らさず、ここに集約する。
 */

/** 水面の高さ（ワールド Y）。水面は y=0 の水平面。 */
export const WATER_LEVEL = 0

/** 水面（正方形）の一辺の半分の長さ。落下範囲もこの矩形に収める。 */
export const POND_HALF = 5

/** 星の落下開始高さ。高いほど長く落ちて軌跡（流星の筋）が長くなる。 */
export const DROP_START_Y = 32

/** 重力加速度（units/sec^2）。飛沫など固定用途のベース値。 */
export const GRAVITY = 9.0

/** 落下速度スライダー（0..1）→ 重力。小さいほどゆっくり夢のように落ちる。 */
const MIN_GRAVITY = 2.5
const MAX_GRAVITY = 17
export function levelToGravity(level: number): number {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
  return MIN_GRAVITY + (MAX_GRAVITY - MIN_GRAVITY) * clamp01(level)
}

/** 星の生成間隔のゆらぎ（秒）。min〜max の一様乱数で次の星までの間隔を決める。
 *  しっかり星が降っていて、バーにも頻繁に当たって音が鳴るくらいの密度。 */
export const SPAWN_INTERVAL_MIN = 0.04
export const SPAWN_INTERVAL_MAX = 0.16

/** 1 回の生成で同時に落とす星の数（ゆらぎを持たせて降るように）。 */
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

/** 高さ勾配 → 法線の強さ。拡散水面なので強めにしてもOK（陰影でさざ波がはっきり出る）。 */
export const WATER_NORMAL_STRENGTH = 2.4

/** 着地時に波紋へ与える波の強さ（通常／バー命中）。星が密＆集中しても飽和しないよう控えめ。 */
export const IMPACT_STRENGTH = 0.22
export const IMPACT_STRENGTH_HIT = 0.4

/**
 * 鳴る音域のもと（ペンタトニック ＝ C メジャー系、C3〜E6 の 18 音）。
 * 音域スライダーは「この並びの高い方から何本ぶん使うか」を変える。
 * どの順で当たっても不協和になりにくいので、狭くても広くても気持ちよく鳴る。
 */
const PENTATONIC_POOL = [
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
  'C6', 'D6', 'E6',
] as const

/** なぞり作曲で使う音高プール（低→高）。線の縦位置をこの範囲にマップする。 */
export const PITCH_POOL: readonly string[] = PENTATONIC_POOL

/** 0(低)〜1(高) の比率からプールの音名を返す。 */
export function poolNoteAt(frac: number): string {
  const f = Math.max(0, Math.min(1, frac))
  return PITCH_POOL[Math.round(f * (PITCH_POOL.length - 1))]
}

/** 音域スライダーで取りうるバー本数の範囲。 */
export const MIN_BARS = 6
export const MAX_BARS = 17
/** バー間隔の最大、および列の最大横幅。一列は広めに取り、音ごとの間を空けて強弱を付けやすく。 */
const SPACING_MAX = 1.05
const MAX_SPAN = 13.5

/** 一列モードで星が降る帯（前後位置と奥行）。横幅はバー列から動的に決める。 */
export const RAIN_FOCUS_Z_CENTER = 0.4
export const RAIN_FOCUS_Z_HALF = 1.7

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** スライダー値 0..1 → バー本数（MIN_BARS〜MAX_BARS）。 */
export function levelToCount(level: number): number {
  return Math.round(MIN_BARS + (MAX_BARS - MIN_BARS) * clamp01(level))
}

/**
 * 音域スライダー値に対応する「今出ているバーの音名（低→高）」。
 * 描画の縦軸はこの並びにマップする（＝描いた位置と鳴る音・見えるバーが一致）。
 */
export function notesForLevel(level: number): readonly string[] {
  return PENTATONIC_POOL.slice(PENTATONIC_POOL.length - levelToCount(level))
}

/** 0(低)〜1(高) の比率から、指定プールの音名を返す。 */
export function poolNoteAtIn(pool: readonly string[], frac: number): string {
  if (!pool.length) return 'C4'
  const f = Math.max(0, Math.min(1, frac))
  return pool[Math.round(f * (pool.length - 1))]
}

const hueOf = (frac: number) => Math.round(18 + 267 * frac)

/** 板の厚み（Y）。フラットをやめて厚みのある立体にする。低音と高音の高低差(段差)を大きくとる（レンジ約2倍）。 */
const BAR_THICK_MIN = 0.22
const BAR_THICK_MAX = 2.48

/**
 * 板ごとの厚み（段差）は音高ベース。低音ほど厚く（高く）、高音ほど薄く（低く）する。
 * 奥行きのテーパー（低音ほど長い）と揃い、木琴らしいくさび形の段差になる。
 * frac: 0=最低音 … 1=最高音。
 */
function barThickness(frac: number): number {
  const f = Math.max(0, Math.min(1, frac))
  return BAR_THICK_MAX - f * (BAR_THICK_MAX - BAR_THICK_MIN)
}

/** 厚みのある板を水面に planted（底を水面に合わせる）したときの中心 Y。 */
function barCenterY(thickness: number): number {
  return WATER_LEVEL + thickness / 2
}

/** 一列レイアウト。低音(左)→高音(右)、低音ほど長い板。横幅は本数で自動。厚みは段差で起伏。 */
function makeRowBars(notes: readonly string[]): BarDef[] {
  const c = notes.length
  const spacing = Math.min(SPACING_MAX, MAX_SPAN / Math.max(1, c - 1))
  const spread = spacing * (c - 1)
  return notes.map((note, i) => {
    const frac = c > 1 ? i / (c - 1) : 0
    const thick = barThickness(frac)
    // 板は長め（奥行 Z）。低音ほど長い。厚みは音高ベースの段差（底は水面に揃える）。
    return {
      id: i,
      position: [-spread / 2 + spacing * i, barCenterY(thick), 0.1] as const,
      size: [spacing * 0.82, thick, 2.9 - 1.0 * frac] as const,
      rotationY: 0,
      note,
      color: `hsl(${hueOf(frac)}, 55%, 62%)`,
    }
  })
}

/**
 * 円形レイアウト。バーを円周に放射状（長辺＝半径方向）に並べる。
 * 密集して的が重なるので一列より当たりやすい＝音が鳴りやすい。
 */
function makeCircleBars(notes: readonly string[]): BarDef[] {
  const c = notes.length
  const radius = Math.max(1.7, Math.min(3.4, 0.2 * c))
  const tangential = Math.min(0.55, ((2 * Math.PI * radius) / c) * 0.82)
  // 円形は全バー同じ長さにして、リングがガタつかないよう整列させる。
  const depth = 1.9
  return notes.map((note, i) => {
    const frac = c > 1 ? i / (c - 1) : 0
    const theta = (i / c) * Math.PI * 2
    const thick = barThickness(frac)
    return {
      id: i,
      position: [Math.sin(theta) * radius, barCenterY(thick), Math.cos(theta) * radius] as const,
      size: [tangential, thick, depth] as const,
      rotationY: theta,
      note,
      color: `hsl(${hueOf(frac)}, 55%, 62%)`,
    }
  })
}

/** 指定本数・配置のバーを生成する。プールの高い方から count 本（狭い音域＝高音側）。 */
export function makeBars(count: number, shape: 'row' | 'circle' = 'row'): BarDef[] {
  const c = Math.max(MIN_BARS, Math.min(MAX_BARS, count))
  const notes = PENTATONIC_POOL.slice(PENTATONIC_POOL.length - c)
  return shape === 'circle' ? makeCircleBars(notes) : makeRowBars(notes)
}

/** 一列モードで星を散らす横半幅（バー列の広がりから）。 */
export function rowFocusXHalf(bars: readonly BarDef[]): number {
  if (bars.length < 2) return 3.8
  const spread = bars[bars.length - 1].position[0] - bars[0].position[0]
  return Math.max(spread / 2 + 0.6, 3.8)
}

/** 円形モードで星を散らす円の半径（バー円＋余白）。 */
export function circleFocusRadius(bars: readonly BarDef[]): number {
  let maxR = 0
  for (const b of bars) {
    const r = Math.hypot(b.position[0], b.position[2])
    if (r > maxR) maxR = r
  }
  return maxR + 0.9
}

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
  /** Y 軸まわりの回転（円形配置で半径方向を向かせる）。一列は 0。 */
  rotationY: number
  /** 当たったときに鳴る音。 */
  note: string
  /** バーの基調色。 */
  color: string
}
