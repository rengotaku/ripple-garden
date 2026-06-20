/**
 * 端末に応じた描画品質。スマホ等の非力な端末では解像度・分割数・影などを落として軽くする。
 * 起動時に 1 度だけ判定する。
 */
function detectMobile(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false
  const touch = (navigator.maxTouchPoints ?? 0) > 0
  const small = Math.min(window.innerWidth, window.innerHeight) < 768
  return (coarse && touch) || small
}

export const isMobile = detectMobile()

export const quality = {
  /** Canvas の dpr 範囲。 */
  dpr: (isMobile ? [0.75, 1.25] : [1, 2]) as [number, number],
  /** 水面シミュレーションのテクスチャ解像度。 */
  simRes: isMobile ? 128 : 256,
  /** 水面メッシュの分割数。 */
  waterSegments: isMobile ? 96 : 200,
  /** 霧の粒子数。 */
  sparkles: isMobile ? 24 : 60,
  /** 影を落とすか（影は重いのでスマホは無効）。 */
  shadows: !isMobile,
  /** 後処理のマルチサンプリング。 */
  multisampling: isMobile ? 0 : 4,
}
