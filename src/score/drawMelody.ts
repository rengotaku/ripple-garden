import type { SongNote } from '../audio/songs'
import { PITCH_POOL, poolNoteAtIn } from '../config'

/** 描画点（画面座標）。t は時刻(ms)。 */
export type Point = { x: number; y: number; t: number }
/** 1 本のストローク（pointerdown→up の点列）。 */
export type Stroke = Point[]

/** 1 音あたりの再生時間（秒）＝テンポ。custom 曲のテンポもこれに合わせる。 */
export const MELODY_STEP_SEC = 0.36
/** 1 音あたりの「描いた線の長さ」目安ピクセル（長く描くほど音数が増える）。 */
const PX_PER_NOTE = 70
/** 上下の端に設ける「最高音／最低音」帯の割合。画面端のUI(ツール/アクション)とかぶらないよう余白を広めに。 */
const PITCH_PAD = 0.2
/** 直前ストロークと横スパンがこの割合以上重なったら「和音（同じ時間帯）」とみなす。 */
const CHORD_OVERLAP_RATIO = 0.5
/** 1 メロディの最大ステップ数（保存・再生コスト上限）。 */
const MAX_STEPS = 96

/** 旋律ごとの時の流れ（0..1）→ 1 音あたりの基準秒数。0.5 で標準 MELODY_STEP_SEC。 */
export function stepSecForTempo(tempo: number): number {
  const t = Math.max(0, Math.min(1, tempo))
  return MELODY_STEP_SEC * (1.8 - 1.6 * t) // t=0:遅い(×1.8) / 0.5:標準(×1) / 1:速い(×0.2)
}

/** 全体の時の流れ（0..1）→ 全レイヤー共通の速さ倍率（マスター）。0.5 で等倍。 */
export function masterTempoRate(tempo: number): number {
  const t = Math.max(0, Math.min(1, tempo))
  return 0.4 + 1.2 * t // t=0:×0.4(遅) / 0.5:×1 / 1:×1.6(速)
}

/**
 * 実際の 1 音あたり秒数 = 旋律ごとの基準秒数 ÷ 全体マスター倍率。
 * 個別（layerTempo）でその旋律の速さ、全体（masterTempo）で合奏全体の流れを決める。
 */
export function noteSec(layerTempo: number, masterTempo: number): number {
  return stepSecForTempo(layerTempo) / masterTempoRate(masterTempo)
}

/** 音名 → 画面 y（縦マッピングの逆。前レイヤーを薄く描く用）。 */
export function pitchToY(note: string, height: number): number {
  const idx = PITCH_POOL.indexOf(note)
  const frac = idx >= 0 ? idx / (PITCH_POOL.length - 1) : 0.5
  return height * (1 - PITCH_PAD - frac * (1 - 2 * PITCH_PAD))
}

/** 1 ストロークを弧長で等間隔サンプリングし、縦位置→音高（pool 内）の連なりにする。 */
function sampleStroke(points: Point[], height: number, pool: readonly string[]): string[] {
  if (points.length < 2 || height <= 0) return []

  // 線に沿った累積距離（弧長）。
  const cum: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  const total = cum[cum.length - 1]
  if (total < 2) return []

  /** 弧長 s の位置での y（線分を線形補間）。 */
  const yAtArc = (s: number): number => {
    if (s <= 0) return points[0].y
    if (s >= total) return points[points.length - 1].y
    for (let i = 0; i < points.length - 1; i++) {
      if (s >= cum[i] && s <= cum[i + 1]) {
        const seg = cum[i + 1] - cum[i]
        const f = seg > 1e-6 ? (s - cum[i]) / seg : 0
        return points[i].y + (points[i + 1].y - points[i].y) * f
      }
    }
    return points[points.length - 1].y
  }

  const count = Math.max(2, Math.min(MAX_STEPS, Math.round(total / PX_PER_NOTE)))
  const stepLen = total / Math.max(1, count - 1)
  const pitches: string[] = []
  for (let k = 0; k < count; k++) {
    const s = stepLen * k
    // 弧長方向に少し平均してジッタを均す（なめらかな音運び）。
    let sy = 0
    let ns = 0
    for (let j = -2; j <= 2; j++) {
      sy += yAtArc(s + (stepLen * j) / 4)
      ns++
    }
    const yn = sy / ns / height
    const frac = (1 - yn - PITCH_PAD) / (1 - 2 * PITCH_PAD)
    pitches.push(poolNoteAtIn(pool, frac))
  }
  return pitches
}

/** 区間 [aMin,aMax] と [bMin,bMax] の重なり割合（短い方の幅基準）。 */
function overlapRatio(aMin: number, aMax: number, bMin: number, bMax: number): number {
  const ov = Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin))
  return ov / Math.max(1, Math.min(aMax - aMin, bMax - bMin))
}

/**
 * 複数ストローク（自由作画）をメロディに変換する。
 * - 各ストローク＝弧長サンプリングした「音の連なり（輪郭）」。縦位置＝音高（上が高音）。
 * - 並びは「描いた順」。ストローク間で縦に跳べば跳躍、別ストロークなので連続音階に縛られない。
 * - 直前ストロークと横スパンが大きく重なるストロークは「同じ時間帯」に重ね、和音にする。
 * ペンタトニックに量子化されるので、跳躍・和音とも不協和になりにくい。
 */
export function strokesToMelody(
  strokes: Stroke[],
  height: number,
  pool: readonly string[],
): SongNote[] {
  if (height <= 0) return []

  // 各ストロークを音高列＋横スパンに。
  const placed: { pitches: string[]; xMin: number; xMax: number }[] = []
  for (const s of strokes) {
    const pitches = sampleStroke(s, height, pool)
    if (!pitches.length) continue
    let xMin = Infinity
    let xMax = -Infinity
    for (const p of s) {
      if (p.x < xMin) xMin = p.x
      if (p.x > xMax) xMax = p.x
    }
    placed.push({ pitches, xMin, xMax })
  }
  if (!placed.length) return []

  // 各ストロークの開始ステップを決め、ステップ→音(和音)のグリッドに積む。
  const grid: string[][] = []
  const pushAt = (step: number, note: string) => {
    while (grid.length <= step) grid.push([])
    if (!grid[step].includes(note)) grid[step].push(note)
  }

  let gridEnd = 0 // 連結末尾（次に順次置くステップ）
  let prevStart = 0
  let prevXMin = Infinity
  let prevXMax = -Infinity
  placed.forEach((p, i) => {
    const overlapsPrev =
      i > 0 && overlapRatio(p.xMin, p.xMax, prevXMin, prevXMax) >= CHORD_OVERLAP_RATIO
    const start = overlapsPrev ? prevStart : gridEnd
    for (let k = 0; k < p.pitches.length; k++) pushAt(start + k, p.pitches[k])
    prevStart = start
    prevXMin = p.xMin
    prevXMax = p.xMax
    gridEnd = Math.max(gridEnd, start + p.pitches.length)
  })

  const notes: SongNote[] = []
  for (let s = 0; s < Math.min(grid.length, MAX_STEPS); s++) {
    notes.push({ notes: grid[s] ?? [], beats: 1 })
  }
  return notes
}
