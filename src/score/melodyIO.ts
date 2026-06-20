import type { SongNote } from '../audio/songs'

/**
 * なぞって作ったメロディの保存（エクスポート）／読み込み（インポート）。
 * 再インポート可能な JSON を媒体にする（楽譜 SVG は閲覧用として別途）。
 */
const FILE_TYPE = 'ripple-garden-melody'

export function exportMelody(melody: SongNote[]): void {
  const data = { type: FILE_TYPE, version: 1, notes: melody }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ripple-garden-melody-${timestamp()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importMelody(file: File): Promise<SongNote[]> {
  const text = await file.text()
  const data = JSON.parse(text)
  if (!data || !Array.isArray(data.notes)) {
    throw new Error('メロディ形式ではありません')
  }
  return data.notes
    .map(
      (n: unknown): SongNote => {
        const obj = (n ?? {}) as { note?: unknown; beats?: unknown }
        return {
          note: typeof obj.note === 'string' ? obj.note : null,
          beats: Number(obj.beats) > 0 ? Number(obj.beats) : 1,
        }
      },
    )
    .slice(0, 512)
}

function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
