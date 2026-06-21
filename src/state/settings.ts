/**
 * 実行時に UI から調整する設定。毎フレーム読まれるホットパス用に、
 * waterField と同様にミュータブルな小さなストアとして扱う。
 * 描画に影響する項目（音域の幅・バー配置）は購読 → React 再描画できるようにする。
 */
export type BarShape = 'row' | 'circle'

export const settings = {
  /**
   * アンビエントの星の量 0..1（スライダー）。既定 0.5（つまみは中央）。
   * 実効量は max(0, (rain-0.5)*2)：中央=0（降らない＝従来の 0 と同じ）、右へ動かすほど増える。
   */
  rain: 0.5,
  /**
   * 星の再生/停止（マスター）。OFF で「全ての落下星」が止まる
   * ＝アンビエント雨も、なぞって作曲の演奏ドロップも停止し、飛行中の星も消える。
   * 既定 ON（描けば即鳴る）。
   */
  rainOn: true,
  /** 音域の幅 0..1（スライダー）。小さいほど本数が少なく狭い音域。 */
  rangeLevel: 0.64,
  /**
   * 落下速度 0..1（スライダー）。場全体の「速さ」を一括で支配する。
   * 星の落下・天体の周回に加え、なぞって作曲の旋律マスターテンポも兼ねる
   * （個別の速さは layer.tempo）。小さいほどゆっくり、星停止中でも旋律の速さに効く。
   */
  fallSpeed: 0.5,
  /** マスター音量 0..1（スライダー）。0 で無音。既定 0.8 ≒ 従来の -10dB。 */
  volume: 0.8,
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

export function setVolume(v: number): void {
  settings.volume = Math.max(0, Math.min(1, v))
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
