import type { Texture } from 'three'

/** 水面シミュレーションの状態を WaterSim / WaterPlane / RainSystem 間で共有するための器。 */
export type Impact = { u: number; v: number; strength: number }

export type WaterField = {
  /** 最新の高さテクスチャ（WaterSim が毎フレーム更新）。 */
  texture: Texture | null
  /** 次のシム更新で注入する着水点。WaterSim が消費してクリアする。 */
  impacts: Impact[]
  /** シミュレーション解像度。 */
  resolution: number
}

export function createWaterField(resolution: number): WaterField {
  return { texture: null, impacts: [], resolution }
}
