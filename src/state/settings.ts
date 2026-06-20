/**
 * 実行時に UI から調整する設定。毎フレーム読まれるホットパス用に、
 * waterField と同様にミュータブルな小さなストアとして扱う。
 * rangeLevel（音域の幅）だけは描画に影響するので、購読 → React 再描画できるようにする。
 */
export const settings = {
  /** 雨量 0..1（スライダー）。0 で雨が止む。 */
  rain: 0.55,
  /** 鉄琴バーが自動でゆっくり動くモード。 */
  autoSlide: false,
  /** 音域の幅 0..1（スライダー）。小さいほど本数が少なく狭い音域。 */
  rangeLevel: 0.64,
  /** 落下速度 0..1（スライダー）。小さいほどゆっくり落ちる。 */
  fallSpeed: 0.5,
}

export function setRain(v: number): void {
  settings.rain = Math.max(0, Math.min(1, v))
}

export function setFallSpeed(v: number): void {
  settings.fallSpeed = Math.max(0, Math.min(1, v))
}

export function setAutoSlide(v: boolean): void {
  settings.autoSlide = v
}

// --- rangeLevel は購読可能（音域を変えると板を作り直すため） ---
const listeners = new Set<() => void>()

export function setRangeLevel(v: number): void {
  settings.rangeLevel = Math.max(0, Math.min(1, v))
  listeners.forEach((l) => l())
}

export function getRangeLevel(): number {
  return settings.rangeLevel
}

export function subscribeRangeLevel(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
