import type { SongNote } from '../audio/songs'
import { PITCH_POOL, poolNoteAt } from '../config'

/** 描画点（画面座標）。t は時刻(ms)。 */
export type Point = { x: number; y: number; t: number }

/** 1 音あたりの再生時間（秒）＝テンポ。custom 曲のテンポもこれに合わせる。 */
export const MELODY_STEP_SEC = 0.36
/** 1 音あたりの「なぞった線の長さ」目安ピクセル（長く描くほど音数が増える）。 */
const PX_PER_NOTE = 70
/** 上下の端に設ける「最高音／最低音」帯の割合。上の方に描けば高音へ届きやすくする。 */
const PITCH_PAD = 0.16

/** 音名 → 画面 y（縦マッピングの逆。前レイヤーを薄く描く用）。 */
export function pitchToY(note: string, height: number): number {
  const idx = PITCH_POOL.indexOf(note)
  const frac = idx >= 0 ? idx / (PITCH_POOL.length - 1) : 0.5
  return height * (1 - PITCH_PAD - frac * (1 - 2 * PITCH_PAD))
}

/**
 * なぞった線をメロディに変換する。
 * 「なぞった線に沿って（弧長で）」等間隔にサンプリングするので、実際になぞった箇所
 * だけが音になる（横方向に補間して描いていない所まで埋める、という挙動はしない）。
 * 縦位置＝音の高さ（上が高音）。ペンタトニックに量子化されるので外れた音にならない。
 */
export function pointsToMelody(points: Point[], height: number): SongNote[] {
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
    // 単調増加なので線形探索で十分。
    for (let i = 0; i < points.length - 1; i++) {
      if (s >= cum[i] && s <= cum[i + 1]) {
        const seg = cum[i + 1] - cum[i]
        const f = seg > 1e-6 ? (s - cum[i]) / seg : 0
        return points[i].y + (points[i + 1].y - points[i].y) * f
      }
    }
    return points[points.length - 1].y
  }

  const count = Math.max(4, Math.min(96, Math.round(total / PX_PER_NOTE)))
  const stepLen = total / Math.max(1, count - 1)
  const notes: SongNote[] = []
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
    notes.push({ note: poolNoteAt(frac), beats: 1 })
  }
  return notes
}
