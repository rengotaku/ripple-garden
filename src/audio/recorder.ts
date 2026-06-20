/**
 * 鳴った音（バー命中）を時刻つきで記録する。あとで楽譜として書き出すために使う。
 * 古い記録は捨てて長さを制限する（放置で延々と鳴るため）。
 */
export type NoteEvent = { note: string; time: number }

const MAX_EVENTS = 1500
let events: NoteEvent[] = []
let startTime: number | null = null

/** time は秒（Tone.now() を想定）。最初の音を 0 秒として相対時刻で保持。 */
export function recordNote(note: string, time: number): void {
  if (startTime === null) startTime = time
  if (events.length >= MAX_EVENTS) events.shift()
  events.push({ note, time: time - startTime })
}

export function getEvents(): NoteEvent[] {
  return events.slice()
}

export function hasRecording(): boolean {
  return events.length > 0
}

export function clearRecording(): void {
  events = []
  startTime = null
}
