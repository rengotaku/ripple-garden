/**
 * 実行時に UI から調整する設定。毎フレーム読まれるホットパス用に、
 * waterField と同様にミュータブルな小さなストアとして扱う。
 * 描画に影響する項目（音域の幅・バー配置）は購読 → React 再描画できるようにする。
 */
export type BarShape = 'row' | 'circle'

export const settings = {
  /** 雨量 0..1（スライダー）。0 で雨が止む。 */
  rain: 0.55,
  /** 雨を降らせるか（停止トグル）。false で雨量に関わらず止まる。 */
  rainOn: true,
  /** 音域の幅 0..1（スライダー）。小さいほど本数が少なく狭い音域。 */
  rangeLevel: 0.64,
  /** 落下速度 0..1（スライダー）。小さいほどゆっくり落ちる。 */
  fallSpeed: 0.5,
  /** バーの配置（一列 / 円形）。 */
  barShape: 'row' as BarShape,
}

export function setRain(v: number): void {
  settings.rain = Math.max(0, Math.min(1, v))
}

export function setRainOn(v: boolean): void {
  settings.rainOn = v
}

export function setFallSpeed(v: number): void {
  settings.fallSpeed = Math.max(0, Math.min(1, v))
}

// --- レイアウト（音域の幅・バー配置）は購読可能（変えると板を作り直すため） ---
const listeners = new Set<() => void>()
function emitLayout(): void {
  listeners.forEach((l) => l())
}

export function setRangeLevel(v: number): void {
  settings.rangeLevel = Math.max(0, Math.min(1, v))
  emitLayout()
}

export function setBarShape(v: BarShape): void {
  settings.barShape = v
  emitLayout()
}

/** レイアウトの現在値を表すキー（useSyncExternalStore 用、変化検出に使う）。 */
export function getLayoutSnapshot(): string {
  return `${settings.rangeLevel.toFixed(3)}:${settings.barShape}`
}

export function subscribeLayout(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
