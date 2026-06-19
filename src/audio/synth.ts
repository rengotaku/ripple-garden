import * as Tone from 'tone'

/**
 * 鉄琴っぽい減衰の速いシンセを 1 つ用意し、滴がバーに当たるたびに鳴らす。
 * ブラウザの自動再生制限のため、最初のユーザー操作で startAudio() を呼ぶ必要がある。
 */

let synth: Tone.PolySynth<Tone.Synth> | null = null
let started = false

function ensureSynth(): Tone.PolySynth<Tone.Synth> {
  if (synth) return synth
  const reverb = new Tone.Reverb({ decay: 3, wet: 0.35 }).toDestination()
  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.6 },
    volume: -8,
  }).connect(reverb)
  return synth
}

/** ユーザー操作（クリック）後に呼ぶ。AudioContext を起動する。 */
export async function startAudio(): Promise<void> {
  if (started) return
  await Tone.start()
  ensureSynth()
  started = true
}

/** バーに着水したときに、そのバーの音を鳴らす。 */
export function playNote(note: string): void {
  if (!started) return
  ensureSynth().triggerAttackRelease(note, '8n')
}
