import type { SongNote } from '../audio/songs'
import type { Layer, NormPoint } from '../state/layers'

/**
 * なぞって作曲の「レイヤー一式（合奏）」の保存（エクスポート）／読み込み（インポート）。
 * 再インポート可能な JSON を媒体にする。
 */
const FILE_TYPE = 'hoshikanade-composition'

export type ImportedLayer = {
  notes: SongNote[]
  enabled: boolean
  strokes?: NormPoint[][]
  tempo?: number
}

export function exportComposition(layers: Layer[]): void {
  const data = {
    type: FILE_TYPE,
    version: 1,
    layers: layers.map((l) => ({
      notes: l.notes,
      enabled: l.enabled,
      strokes: l.strokes,
      tempo: l.tempo,
    })),
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hoshikanade-composition-${timestamp()}.json`
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
      const obj = (l ?? {}) as {
        notes?: unknown
        enabled?: unknown
        strokes?: unknown
        tempo?: unknown
      }
      const notes = Array.isArray(obj.notes)
        ? obj.notes.map((n: unknown): SongNote => {
            const o = (n ?? {}) as { note?: unknown; notes?: unknown; beats?: unknown }
            // 新形式: notes:string[]（和音）。旧形式: note:string|null（単音/休符）も読む。
            const chord = Array.isArray(o.notes)
              ? o.notes.filter((x): x is string => typeof x === 'string')
              : typeof o.note === 'string'
                ? [o.note]
                : []
            return {
              notes: chord,
              beats: Number(o.beats) > 0 ? Number(o.beats) : 1,
            }
          })
        : []
      // 描いた軌跡（正規化座標）。再表示専用・任意。壊れた値は捨てる。
      const strokes = Array.isArray(obj.strokes)
        ? obj.strokes
            .map((s: unknown): NormPoint[] =>
              Array.isArray(s)
                ? s
                    .map((p: unknown) => (p ?? {}) as { x?: unknown; y?: unknown })
                    .filter((p) => typeof p.x === 'number' && typeof p.y === 'number')
                    .map((p) => ({ x: p.x as number, y: p.y as number }))
                : [],
            )
            .filter((s) => s.length >= 2)
        : undefined
      return {
        notes: notes.slice(0, 512),
        enabled: obj.enabled !== false,
        strokes: strokes && strokes.length ? strokes : undefined,
        tempo: typeof obj.tempo === 'number' ? obj.tempo : undefined,
      }
    })
    .filter((l) => l.notes.length)
    .slice(0, 16)
}

function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
