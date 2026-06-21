import type { NoteEvent } from '../audio/recorder'

/**
 * 記録した音（音名＋時刻）を ABC 記譜文字列へ変換する。
 * 星の当たりは不規則なので、8 分音符グリッドに量子化し、近接した音は和音にまとめ、
 * 音が無い区間は休符にする（長い無音は 1 小節ぶんに圧縮）。読みやすい単旋律＋和音の譜になる。
 */

/** 8 分音符 1 つぶんの秒数（テンポ）。Q:1/4=100 → 8分 = 0.3 秒。 */
const EIGHTH_SEC = 0.3
/** 譜に載せる最大スロット数（=8分音符の数）。長すぎる譜を避ける。 */
const MAX_SLOTS = 192

/** 音名 'C4' / 'G5' などを ABC のピッチ表記へ。ペンタトニックなので臨時記号は無い。 */
export function noteToAbc(note: string): string {
  const letter = note[0].toUpperCase()
  const octave = parseInt(note.slice(1), 10)
  if (Number.isNaN(octave)) return letter
  // ABC: C=C4, c=C5, c'=C6 ... C,=C3, C,,=C2
  if (octave >= 5) return letter.toLowerCase() + "'".repeat(octave - 5)
  if (octave === 4) return letter
  return letter + ','.repeat(4 - octave)
}

/** 同時に近接した音をまとめて 1 スロットの ABC トークン（単音 or 和音）にする。 */
function slotToken(notes: string[]): string {
  const uniq = Array.from(new Set(notes))
  const abc = uniq.map(noteToAbc)
  return abc.length === 1 ? abc[0] : `[${abc.join('')}]`
}

export function eventsToAbc(events: NoteEvent[], title = '星奏'): string {
  const evs = [...events].sort((a, b) => a.time - b.time)

  // 近接（半スロット未満）の音を 1 グループに。
  const groups: { time: number; notes: string[] }[] = []
  for (const e of evs) {
    const last = groups[groups.length - 1]
    if (last && e.time - last.time < EIGHTH_SEC * 0.5) {
      last.notes.push(e.note)
    } else {
      groups.push({ time: e.time, notes: [e.note] })
    }
  }

  // スロット列（各スロット = 8 分音符 1 つ分の ABC トークン）。
  const slots: string[] = []
  for (let i = 0; i < groups.length; i++) {
    if (i > 0) {
      const gap = Math.round((groups[i].time - groups[i - 1].time) / EIGHTH_SEC)
      // 直前の音が 1 スロット占有。残りを休符に（最大 1 小節 = 8 に圧縮）。
      const rests = Math.min(Math.max(gap - 1, 0), 8)
      for (let r = 0; r < rests; r++) slots.push('z')
    }
    slots.push(slotToken(groups[i].notes))
  }

  const capped = slots.slice(-MAX_SLOTS)

  // 4/4・8 分音符基準。8 スロットごとに小節線。
  let body = ''
  for (let i = 0; i < capped.length; i++) {
    if (i > 0 && i % 8 === 0) body += '|\n'
    body += capped[i] + ' '
  }
  body = body.trim() + ' |]'

  return [
    'X:1',
    `T:${title}`,
    'C:generative (星奏 / hoshikanade)',
    'M:4/4',
    'L:1/8',
    'Q:1/4=100',
    'K:C',
    body,
  ].join('\n')
}
