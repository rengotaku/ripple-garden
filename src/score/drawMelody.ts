import type { SongNote } from '../audio/songs'
import { poolNoteAt } from '../config'

/** 描画点。t は時刻(ms)。描いた速度＝曲の速さになるよう時間で区切る。 */
export type Point = { x: number; y: number; t: number }

/** 1 音あたりの基準時間（秒）。custom 曲のテンポもこれに合わせる。やや長めでゆるやかに。 */
export const MELODY_STEP_SEC = 0.42

/** 時刻 t での線の縦位置 y を線形補間で求める。 */
function yAtTime(points: Point[], t: number): number {
  if (t <= points[0].t) return points[0].y
  const last = points[points.length - 1]
  if (t >= last.t) return last.y
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t
      const f = span > 0 ? (t - a.t) / span : 0
      return a.y + (b.y - a.y) * f
    }
  }
  return last.y
}

/**
 * なぞった線をメロディに変換する。
 * 描いた「時間」を MELODY_STEP_SEC ごとに区切り、その時刻の線の縦位置 → 音の高さにマップ。
 * → ゆっくり描けば音はまばらでゆるやか、速く描けば速い曲になる。
 * 上が高音・下が低音。ペンタトニックに量子化されるので外れた音にならない。
 */
export function pointsToMelody(points: Point[], height: number): SongNote[] {
  if (points.length < 2 || height <= 0) return []
  const t0 = points[0].t
  const tEnd = points[points.length - 1].t
  const durSec = Math.max(0.4, (tEnd - t0) / 1000)
  const count = Math.max(4, Math.min(96, Math.round(durSec / MELODY_STEP_SEC)))

  const win = ((tEnd - t0) / Math.max(1, count - 1)) * 0.5 // 1 音ぶんの半分の時間窓
  const notes: SongNote[] = []
  for (let k = 0; k < count; k++) {
    const t = t0 + ((tEnd - t0) * k) / Math.max(1, count - 1)
    // 時間窓で平均してジッタを均し、なめらか＝ゆるやかな音運びにする。
    let sy = 0
    let ns = 0
    for (let s = -2; s <= 2; s++) {
      sy += yAtTime(points, t + (win * s) / 2)
      ns++
    }
    const frac = 1 - Math.max(0, Math.min(1, sy / ns / height)) // 上=高音
    notes.push({ note: poolNoteAt(frac), beats: 1 })
  }
  return notes
}
