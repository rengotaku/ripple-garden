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

/** 鉄琴バー（細長い箱）の配置と寸法。 */
export const BAR = {
  position: [0, WATER_LEVEL + 0.1, 0.5] as const,
  /** [幅(X), 高さ(Y), 奥行(Z)] */
  size: [2.2, 0.2, 0.5] as const,
}

/**
 * 鉄琴バーに当たったときに鳴らす音（ペンタトニック）。
 * 1 滴 = 1 音。当たるたびにこの中からランダムで選ぶと箱庭的に心地よい。
 */
export const PENTATONIC = ['C5', 'D5', 'E5', 'G5', 'A5'] as const
