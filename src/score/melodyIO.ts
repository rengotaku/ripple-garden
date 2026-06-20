import type { SongNote } from '../audio/songs'
import type { Layer } from '../state/layers'

/**
 * なぞって作曲の「レイヤー一式（合奏）」の保存（エクスポート）／読み込み（インポート）。
 * 再インポート可能な JSON を媒体にする。
 */
const FILE_TYPE = 'ripple-garden-composition'

export type ImportedLayer = { notes: SongNote[]; enabled: boolean }

export function exportComposition(layers: Layer[]): void {
  const data = {
    type: FILE_TYPE,
    version: 1,
    layers: layers.map((l) => ({ notes: l.notes, enabled: l.enabled })),
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ripple-garden-composition-${timestamp()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importComposition(file: File): Promise<ImportedLayer[]> {
  const text = await file.text()
  const data = JSON.parse(text)
  // 旧形式（単一メロディ）も読めるようにする。
  const rawLayers: unknown[] = Array.isArray(data?.layers)
    ? data.layers
    : Array.isArray(data?.notes)
      ? [{ notes: data.notes, enabled: true }]
      : []
  return rawLayers
    .map((l): ImportedLayer => {
      const obj = (l ?? {}) as { notes?: unknown; enabled?: unknown }
      const notes = Array.isArray(obj.notes)
        ? obj.notes.map((n: unknown): SongNote => {
            const o = (n ?? {}) as { note?: unknown; beats?: unknown }
            return {
              note: typeof o.note === 'string' ? o.note : null,
              beats: Number(o.beats) > 0 ? Number(o.beats) : 1,
            }
          })
        : []
      return { notes: notes.slice(0, 512), enabled: obj.enabled !== false }
    })
    .filter((l) => l.notes.length)
    .slice(0, 16)
}

function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
