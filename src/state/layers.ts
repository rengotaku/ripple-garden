import type { SongNote } from '../audio/songs'
import { STEPS_PER_MEASURE } from '../score/drawMelody'

/** 描いた軌跡の 1 点（正規化座標 0..1。解像度に依存しないので再表示で実物を描ける）。 */
export type NormPoint = { x: number; y: number }

/**
 * 小節（節）の境界メタ。フラットな notes / strokes 配列のうち、その小節が占める本数を持つ。
 * これにより小節単位の編集・削除・サムネイル表示ができる。
 */
export type LayerSection = { noteCount: number; strokeCount: number }

/**
 * 「なぞって作曲」のレイヤー。各レイヤーは 1 本の旋律で、有効なものを同時ループ再生する。
 * 追加・有効/無効・削除ができる。イミュータブルに新配列へ差し替えて購読者へ通知する。
 *
 * notes / strokes は小節を連結したフラット列（再生・下絵・入出力はこれを使う）。
 * sections は「どこからどこまでが何小節目か」の境界メタ（未定義＝全体で1小節。旧データ互換）。
 * strokes は描いた軌跡そのもの（正規化済み）。再表示専用・任意。
 */
export type Layer = {
  id: number
  notes: SongNote[]
  enabled: boolean
  color: string
  strokes?: NormPoint[][]
  /** 小節境界（未定義＝1小節）。 */
  sections?: LayerSection[]
  /** この旋律の演奏速度 0..1（0.5=標準）。旋律ごとに個別調整できる。 */
  tempo: number
}

const DEFAULT_TEMPO = 0.5

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

/** sections を返す（未定義なら「全体で1小節」とみなす）。 */
export function getSections(layer: Layer): LayerSection[] {
  if (layer.sections && layer.sections.length) return layer.sections
  return [{ noteCount: layer.notes.length, strokeCount: layer.strokes?.length ?? 0 }]
}

/** 指定小節が占める notes / strokes の範囲を切り出す（編集・サムネイル用）。 */
export function sectionSlice(
  layer: Layer,
  index: number,
): { notes: SongNote[]; strokes: NormPoint[][] } {
  const secs = getSections(layer)
  const sec = secs[index]
  if (!sec) return { notes: [], strokes: [] }
  let noteStart = 0
  let strokeStart = 0
  for (let i = 0; i < index; i++) {
    noteStart += secs[i].noteCount
    strokeStart += secs[i].strokeCount
  }
  return {
    notes: layer.notes.slice(noteStart, noteStart + sec.noteCount),
    strokes: (layer.strokes ?? []).slice(strokeStart, strokeStart + sec.strokeCount),
  }
}

/** 指定小節を除く、同じレイヤーの他の小節すべての軌跡（下絵表示用）。 */
export function otherSectionStrokes(layer: Layer, exceptIndex: number): NormPoint[][] {
  const secs = getSections(layer)
  const out: NormPoint[][] = []
  for (let i = 0; i < secs.length; i++) {
    if (i === exceptIndex) continue
    out.push(...sectionSlice(layer, i).strokes)
  }
  return out
}

/** 空（無音）の1小節ぶんの音符列（休符イベント）を作る。 */
export function blankMeasureNotes(): SongNote[] {
  return Array.from({ length: STEPS_PER_MEASURE }, () => ({ notes: [] as string[], beats: 1 }))
}

/** 落書き1つ＝小節1つで新規レイヤー（L1）を作る。空小節でも可（1小節目を空にできる）。 */
export function addLayer(notes: SongNote[], strokes?: NormPoint[][], tempo = DEFAULT_TEMPO): void {
  if (!notes.length) return
  const color = COLORS[(nextId - 1) % COLORS.length]
  const sections: LayerSection[] = [{ noteCount: notes.length, strokeCount: strokes?.length ?? 0 }]
  layers = [...layers, { id: nextId++, notes, enabled: true, color, strokes, sections, tempo }]
  emit()
}

/**
 * L2 以降を作る：マスター（先頭レイヤー）と同じ数の空小節を持つレイヤーを追加する。
 * 落書きは持たず、各小節をタップして埋める。先頭が無ければ1小節ぶんで作る。
 */
export function createLayer(): void {
  const master = layers[0]
  const count = master ? getSections(master).length : 1
  const notes = Array.from({ length: count }, () => blankMeasureNotes()).flat()
  const sections: LayerSection[] = Array.from({ length: count }, () => ({
    noteCount: STEPS_PER_MEASURE,
    strokeCount: 0,
  }))
  const color = COLORS[(nextId - 1) % COLORS.length]
  layers = [
    ...layers,
    { id: nextId++, notes, enabled: true, color, strokes: undefined, sections, tempo: DEFAULT_TEMPO },
  ]
  emit()
}

/**
 * マスター（masterId）に小節を継ぎ足し、他の全レイヤーには空小節を継ぎ足す。
 * 全レイヤーの小節数を L1 に揃えたまま、末尾に1小節増やす（縦の整合を保つ）。
 */
export function appendMeasureToAll(masterId: number, notes: SongNote[], strokes?: NormPoint[][]): void {
  if (!notes.length) return
  const strokeList = strokes ?? []
  layers = layers.map((l) => {
    if (l.id === masterId) {
      const merged = [...(l.strokes ?? []), ...strokeList]
      return {
        ...l,
        notes: [...l.notes, ...notes],
        strokes: merged.length ? merged : undefined,
        sections: [...getSections(l), { noteCount: notes.length, strokeCount: strokeList.length }],
      }
    }
    const blank = blankMeasureNotes()
    return {
      ...l,
      notes: [...l.notes, ...blank],
      sections: [...getSections(l), { noteCount: blank.length, strokeCount: 0 }],
    }
  })
  emit()
}

/**
 * 指定位置の小節を全レイヤーから削除する（L1 がマスター。同じ位置を縦に揃えて消す）。
 * 小節が無くなったレイヤーは丸ごと削除する。
 */
export function removeMeasureFromAll(index: number): void {
  layers = layers
    .map((l) => {
      const secs = getSections(l)
      if (index < 0 || index >= secs.length) return l // この小節を持たないレイヤーはそのまま
      let noteStart = 0
      let strokeStart = 0
      for (let i = 0; i < index; i++) {
        noteStart += secs[i].noteCount
        strokeStart += secs[i].strokeCount
      }
      const old = secs[index]
      const flatStrokes = l.strokes ?? []
      const mergedStrokes = [
        ...flatStrokes.slice(0, strokeStart),
        ...flatStrokes.slice(strokeStart + old.strokeCount),
      ]
      return {
        ...l,
        notes: [...l.notes.slice(0, noteStart), ...l.notes.slice(noteStart + old.noteCount)],
        strokes: mergedStrokes.length ? mergedStrokes : undefined,
        sections: secs.filter((_, i) => i !== index),
      }
    })
    .filter((l) => getSections(l).length > 0)
  emit()
}

/** 指定小節だけを描き直す：その小節のスライスを差し替え、境界を更新する。 */
export function replaceSection(
  id: number,
  index: number,
  notes: SongNote[],
  strokes?: NormPoint[][],
): void {
  if (!notes.length) return
  const strokeList = strokes ?? []
  layers = layers.map((l) => {
    if (l.id !== id) return l
    const secs = getSections(l)
    if (index < 0 || index >= secs.length) return l
    let noteStart = 0
    let strokeStart = 0
    for (let i = 0; i < index; i++) {
      noteStart += secs[i].noteCount
      strokeStart += secs[i].strokeCount
    }
    const old = secs[index]
    const flatStrokes = l.strokes ?? []
    const mergedStrokes = [
      ...flatStrokes.slice(0, strokeStart),
      ...strokeList,
      ...flatStrokes.slice(strokeStart + old.strokeCount),
    ]
    return {
      ...l,
      notes: [...l.notes.slice(0, noteStart), ...notes, ...l.notes.slice(noteStart + old.noteCount)],
      strokes: mergedStrokes.length ? mergedStrokes : undefined,
      sections: secs.map((s, i) =>
        i === index ? { noteCount: notes.length, strokeCount: strokeList.length } : s,
      ),
    }
  })
  emit()
}

export function setLayerTempo(id: number, tempo: number): void {
  const t = Math.max(0, Math.min(1, tempo))
  layers = layers.map((l) => (l.id === id ? { ...l, tempo: t } : l))
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

/** インポート用：レイヤー一式を差し替える。sections があれば採用、無ければ1小節扱い。 */
export function setLayers(
  items: {
    notes: SongNote[]
    enabled?: boolean
    strokes?: NormPoint[][]
    sections?: LayerSection[]
    tempo?: number
  }[],
): void {
  layers = items
    .filter((it) => Array.isArray(it.notes) && it.notes.length)
    .map((it) => {
      const color = COLORS[(nextId - 1) % COLORS.length]
      const tempo = typeof it.tempo === 'number' ? Math.max(0, Math.min(1, it.tempo)) : DEFAULT_TEMPO
      const sections = sanitizeSections(it.sections, it.notes.length, it.strokes?.length ?? 0)
      return {
        id: nextId++,
        notes: it.notes,
        enabled: it.enabled !== false,
        color,
        strokes: it.strokes,
        sections,
        tempo,
      }
    })
  emit()
}

/** インポートした sections が notes/strokes 総数と整合するか検証し、合わなければ1小節へ畳む。 */
function sanitizeSections(
  sections: LayerSection[] | undefined,
  noteTotal: number,
  strokeTotal: number,
): LayerSection[] {
  if (!Array.isArray(sections) || !sections.length) {
    return [{ noteCount: noteTotal, strokeCount: strokeTotal }]
  }
  const noteSum = sections.reduce((a, s) => a + (Number(s?.noteCount) || 0), 0)
  const strokeSum = sections.reduce((a, s) => a + (Number(s?.strokeCount) || 0), 0)
  if (noteSum !== noteTotal || strokeSum !== strokeTotal) {
    return [{ noteCount: noteTotal, strokeCount: strokeTotal }]
  }
  return sections.map((s) => ({ noteCount: Number(s.noteCount), strokeCount: Number(s.strokeCount) }))
}
