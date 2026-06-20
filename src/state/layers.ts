import type { SongNote } from '../audio/songs'

/**
 * 「なぞって作曲」のレイヤー。各レイヤーは 1 本の旋律で、有効なものを同時ループ再生する。
 * 追加・有効/無効・削除ができる。イミュータブルに新配列へ差し替えて購読者へ通知する。
 */
export type Layer = {
  id: number
  notes: SongNote[]
  enabled: boolean
  color: string
}

const COLORS = ['#7fd1e6', '#e6b07f', '#9fe07f', '#c98ad8', '#e68a9f', '#d8c87f', '#8a9fe6']

let layers: Layer[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function getLayers(): Layer[] {
  return layers
}

export function subscribeLayers(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function addLayer(notes: SongNote[]): void {
  if (!notes.length) return
  const color = COLORS[(nextId - 1) % COLORS.length]
  layers = [...layers, { id: nextId++, notes, enabled: true, color }]
  emit()
}

export function toggleLayer(id: number): void {
  layers = layers.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l))
  emit()
}

export function removeLayer(id: number): void {
  layers = layers.filter((l) => l.id !== id)
  emit()
}

/** インポート用：レイヤー一式を差し替える。 */
export function setLayers(items: { notes: SongNote[]; enabled?: boolean }[]): void {
  layers = items
    .filter((it) => Array.isArray(it.notes) && it.notes.length)
    .map((it) => {
      const color = COLORS[(nextId - 1) % COLORS.length]
      return { id: nextId++, notes: it.notes, enabled: it.enabled !== false, color }
    })
  emit()
}
