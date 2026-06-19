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

/** 水滴生成間隔のゆらぎ（秒）。min〜max の一様乱数で次の滴までの間隔を決める。 */
export const SPAWN_INTERVAL_MIN = 0.25
export const SPAWN_INTERVAL_MAX = 1.1

/** 波紋の寿命（秒）と最大半径。 */
export const RIPPLE_LIFETIME = 1.8
export const RIPPLE_MAX_RADIUS = 1.1

/** 鉄琴バーに当たったときの波紋（光る方）の寿命と最大半径。 */
export const HIT_RIPPLE_LIFETIME = 1.4
export const HIT_RIPPLE_MAX_RADIUS = 0.9

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
 * マリンバ風に横一列へ並べた鉄琴バー。低音ほど長く（奥行 Z 大）色も温かく、
 * 高音ほど短く明るい色にして視覚的にも音階が分かるようにする。
 * 水滴がランダムに落ちる中で、たまたまバーに当たると音が鳴る——という放置の楽しみ。
 *
 * 音はペンタトニック（C メジャー系）。どの順で当たっても不協和になりにくい。
 */
const BAR_NOTES = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5'] as const
const BAR_COLORS = [
  '#c98a6f',
  '#c9a36f',
  '#bfc96f',
  '#6fc98a',
  '#6fb3c9',
  '#6f8ac9',
  '#9f6fc9',
] as const

export const BARS: readonly BarDef[] = BAR_NOTES.map((note, i) => {
  const count = BAR_NOTES.length
  const spread = 5.6 // 並べる横幅
  const x = -spread / 2 + (spread / (count - 1)) * i
  // 低音(左)ほど長く、高音(右)ほど短く。
  const depth = 1.25 - (0.7 * i) / (count - 1)
  return {
    id: i,
    position: [x, WATER_LEVEL + 0.09, 0.4] as const,
    size: [0.6, 0.18, depth] as const,
    note,
    color: BAR_COLORS[i],
  }
})
