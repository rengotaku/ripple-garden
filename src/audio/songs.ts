/**
 * メロディの音符型と音名ユーティリティ。
 * （プリセット曲は廃止。メロディはすべて「なぞって作曲」のレイヤーから来る）
 */
export type SongNote = { note: string | null; beats: number }

/** 音名 'C4'/'F#4' を MIDI 番号へ（最寄りバー探索用）。 */
const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
export function noteToMidi(name: string): number {
  const m = name.match(/^([A-G])(#?)(\d)$/)
  if (!m) return 60
  const [, letter, sharp, oct] = m
  return 12 * (parseInt(oct, 10) + 1) + SEMITONE[letter] + (sharp ? 1 : 0)
}
