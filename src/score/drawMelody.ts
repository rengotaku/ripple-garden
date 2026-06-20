import type { SongNote } from '../audio/songs'
import { poolNoteAt } from '../config'

export type Point = { x: number; y: number }

/**
 * なぞった線（画面座標の点列）をメロディに変換する。
 * 線を描いた順（時間）に等間隔でサンプリングし、各点の縦位置 → 音の高さにマップする。
 * 上が高音・下が低音。音はペンタトニックに量子化されるので外れた音にならない。
 */
export function pointsToMelody(points: Point[], height: number): SongNote[] {
  if (points.length < 2 || height <= 0) return []
  // 線の長さに応じて音数を決める（短い線は少なく、長い線は多く）。
  const count = Math.max(8, Math.min(64, Math.round(points.length / 5)))
  const notes: SongNote[] = []
  for (let k = 0; k < count; k++) {
    const idx = Math.round(((points.length - 1) * k) / (count - 1))
    const frac = 1 - Math.max(0, Math.min(1, points[idx].y / height)) // 上=高音
    notes.push({ note: poolNoteAt(frac), beats: 1 })
  }
  return notes
}
