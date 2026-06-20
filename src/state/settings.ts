/**
 * 実行時に UI から調整する設定。毎フレーム読まれるホットパス用に、
 * waterField と同様にミュータブルな小さなストアとして扱う。
 */
export const settings = {
  /** 雨量 0..1（スライダー）。0 で雨が止む。 */
  rain: 0.55,
  /** 鉄琴バーが自動でゆっくり動くモード。 */
  autoSlide: false,
}

export function setRain(v: number): void {
  settings.rain = Math.max(0, Math.min(1, v))
}

export function setAutoSlide(v: boolean): void {
  settings.autoSlide = v
}
