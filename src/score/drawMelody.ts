import type { SongNote } from '../audio/songs'
import { poolNoteAtIn, PITCH_POOL } from '../config'

/** 描画点（画面座標）。t は時刻(ms)。 */
export type Point = { x: number; y: number; t: number }
/** 1 本のストローク（pointerdown→up の点列）。 */
export type Stroke = Point[]

/** 1 音あたりの再生時間（秒）＝テンポ。custom 曲のテンポもこれに合わせる。 */
export const MELODY_STEP_SEC = 0.36
/** 上下の端に設ける「最高音／最低音」帯の割合。画面端のUI(ツール/アクション)とかぶらないよう余白を広めに。 */
const PITCH_PAD = 0.2

/** 1 キャンバスが表す小節数（横＝時間。左→右に小節が並ぶ）。 */
export const MEASURES_PER_CANVAS = 4
/** 1 小節あたりのステップ数（拍の細分。各ステップ＝1音ぶんの時間）。 */
export const STEPS_PER_MEASURE = 8
/** キャンバス全体のステップ数（＝時間グリッドの列数）。 */
export const TOTAL_STEPS = MEASURES_PER_CANVAS * STEPS_PER_MEASURE
/** 1 ストロークを弧長でリサンプルする最大点数（列へラスタライズする元の密度）。 */
const SAMPLES_PER_STROKE = 256

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

/** 画面 y（0..height）→ 音高プール内の比率（0=低音 … 1=高音）。 */
function yToPitchFrac(y: number, height: number): number {
  const yn = Math.max(0, Math.min(1, y / height))
  return (1 - yn - PITCH_PAD) / (1 - 2 * PITCH_PAD)
}

/**
 * 1 ストロークを弧長で等間隔サンプリングし、各サンプルを時間グリッドの列へ振り分ける。
 * 横位置(x)＝時間ステップ、縦位置(y)＝音高。同じ列に来たサンプルは平均してその列の音高にする。
 * 戻り値: 列index → 音高プール内の比率。
 */
function rasterStroke(points: Point[], width: number, height: number): Map<number, number> {
  const out = new Map<number, number>()
  if (points.length < 2 || width <= 0 || height <= 0) return out

  // 線に沿った累積距離（弧長）。
  const cum: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  const total = cum[cum.length - 1]
  if (total < 2) return out

  /** 弧長 s の位置での点（線分を線形補間）。 */
  const at = (s: number): { x: number; y: number } => {
    if (s <= 0) return { x: points[0].x, y: points[0].y }
    if (s >= total) return { x: points[points.length - 1].x, y: points[points.length - 1].y }
    for (let i = 0; i < points.length - 1; i++) {
      if (s >= cum[i] && s <= cum[i + 1]) {
        const seg = cum[i + 1] - cum[i]
        const f = seg > 1e-6 ? (s - cum[i]) / seg : 0
        return {
          x: points[i].x + (points[i + 1].x - points[i].x) * f,
          y: points[i].y + (points[i + 1].y - points[i].y) * f,
        }
      }
    }
    return { x: points[points.length - 1].x, y: points[points.length - 1].y }
  }

  const samples = Math.max(2, Math.min(SAMPLES_PER_STROKE, Math.round(total / 4)))
  const acc = new Map<number, { sum: number; n: number }>()
  for (let k = 0; k < samples; k++) {
    const p = at((total * k) / (samples - 1))
    const col = Math.max(0, Math.min(TOTAL_STEPS - 1, Math.floor((p.x / width) * TOTAL_STEPS)))
    const frac = yToPitchFrac(p.y, height)
    const a = acc.get(col)
    if (a) {
      a.sum += frac
      a.n += 1
    } else {
      acc.set(col, { sum: frac, n: 1 })
    }
  }
  for (const [col, a] of acc) out.set(col, a.sum / a.n)
  return out
}

/**
 * 複数ストローク（自由作画）をメロディに変換する（x 軸＝時間のタイムライン）。
 * - 横位置(x)＝発音タイミング（小節グリッドの列に量子化）。縦位置(y)＝音高（上が高音）。
 * - 同じ列に複数ストロークが来れば「和音（同じ時間帯）」として重ねる。
 * - 何も無い列は休符（再生は無音でタイミングだけ進む）。
 * ペンタトニックに量子化されるので、跳躍・和音とも不協和になりにくい。
 * 末尾は小節境界まで詰めるので、ループが小節単位で揃う。
 */
export function strokesToMelody(
  strokes: Stroke[],
  width: number,
  height: number,
  pool: readonly string[],
): SongNote[] {
  if (width <= 0 || height <= 0) return []

  // 列ごとの音高（和音可）。
  const grid: string[][] = Array.from({ length: TOTAL_STEPS }, () => [])
  for (const s of strokes) {
    const cols = rasterStroke(s, width, height)
    for (const [col, frac] of cols) {
      const note = poolNoteAtIn(pool, frac)
      if (!grid[col].includes(note)) grid[col].push(note)
    }
  }

  // 最後に音が鳴る列を探し、小節境界まで切り上げて長さを決める。
  let last = -1
  for (let s = 0; s < TOTAL_STEPS; s++) if (grid[s].length) last = s
  if (last < 0) return []
  const length = Math.ceil((last + 1) / STEPS_PER_MEASURE) * STEPS_PER_MEASURE

  const notes: SongNote[] = []
  for (let s = 0; s < length; s++) notes.push({ notes: [...grid[s]], beats: 1 })
  return notes
}
