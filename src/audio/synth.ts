import * as Tone from 'tone'
import { POND_HALF } from '../config'

/**
 * 放置系アンビエントのための音響エンジン。
 *
 * 設計（リサーチ知見の反映）:
 * - ペンタトニックのバー音は温かいマリンバ音色（partials [1,0,2,0,3]）。
 * - 滴ごとに PanVol を作り、シーン上の x 位置に応じて左右へ定位。velocity/detune を揺らす。
 * - 下に薄いアンビエント・パッド（fat オシレータ＋極低速 LFO ローパス）を流し続ける。
 * - マスターチェーン: Reverb → EQ3 → Compressor → Limiter → Destination。
 * - 解禁は最初のクリックで Tone.start()。音量はゆるやかにフェードイン。Limiter で安全。
 */

const TARGET_DB = -10

type Engine = {
  reverb: Tone.Reverb
  eq: Tone.EQ3
  pad: Tone.PolySynth<Tone.Synth>
  padFilter: Tone.Filter
  padLfo: Tone.LFO
  padLoop: Tone.Loop
}

let engine: Engine | null = null
let started = false
let muted = false
let activeVoices = 0

/** マスターチェーンとアンビエント・パッドを構築する。 */
function buildEngine(): Engine {
  const limiter = new Tone.Limiter(-1).toDestination()
  const comp = new Tone.Compressor({
    threshold: -22,
    ratio: 3,
    attack: 0.05,
    release: 0.25,
  }).connect(limiter)
  const eq = new Tone.EQ3({ low: -1, mid: 0, high: 1.5 }).connect(comp)
  const reverb = new Tone.Reverb({ decay: 5, preDelay: 0.08, wet: 0.42 }).connect(eq)

  // --- アンビエント・パッド（薄いドローン） ---
  const padFilter = new Tone.Filter({
    type: 'lowpass',
    frequency: 600,
    rolloff: -24,
    Q: 0.8,
  }).connect(reverb)
  const padLfo = new Tone.LFO(0.04, 260, 1100) // 0.04Hz の極低速スイープ
  padLfo.connect(padFilter.frequency)
  padLfo.start()

  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsine', count: 3, spread: 30 },
    envelope: { attack: 3, decay: 2, sustain: 0.85, release: 6 },
    volume: -26,
  }).connect(padFilter)

  // ペンタトニックに馴染む 2 つのドローン和音を、噛み合わない長周期で交互に。
  const padChords = [
    ['C2', 'G2', 'C3', 'E3'],
    ['A1', 'E2', 'A2', 'C3'],
  ]
  let chordIdx = 0
  const padLoop = new Tone.Loop((time) => {
    pad.releaseAll(time)
    pad.triggerAttack(padChords[chordIdx % padChords.length], time + 0.05)
    chordIdx += 1
  }, 19) // 19 秒周期（パッド以外と噛み合わせない素数寄りの値）
  padLoop.start(0)

  return { reverb, eq, pad, padFilter, padLfo, padLoop }
}

/** ユーザー操作（クリック）後に呼ぶ。AudioContext を起動し、音を立ち上げる。 */
export async function startAudio(): Promise<void> {
  if (started) return
  await Tone.start()
  engine = buildEngine()
  await engine.reverb.ready

  Tone.getDestination().volume.value = -Infinity
  Tone.getTransport().start()
  started = true
  // ゆるやかにフェードイン
  Tone.getDestination().volume.rampTo(TARGET_DB, 3)
}

/**
 * バーに着水したときに、そのバーの音を温かいマリンバで鳴らす。
 * x はシーン上の横位置（[-POND_HALF, POND_HALF]）で、左右の定位に使う。
 */
export function playNote(note: string, x: number): void {
  if (!started) return
  if (activeVoices > 16) return // 同時発音の暴走を防ぐ

  const pan = Math.max(-1, Math.min(1, x / POND_HALF))
  const panVol = new Tone.PanVol(pan, 0)
  panVol.connect(engine!.reverb)
  panVol.connect(engine!.eq) // ドライ成分も少し

  const voice = new Tone.Synth({
    oscillator: { partials: [1, 0, 2, 0, 3] }, // 木質の倍音（マリンバ）
    envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1.2 },
    volume: -6,
  }).connect(panVol)
  voice.detune.value = (Math.random() * 2 - 1) * 6 // ±6 cent のゆらぎ

  const velocity = 0.5 + Math.random() * 0.4
  voice.triggerAttackRelease(note, '2n', undefined, velocity)

  activeVoices += 1
  // 余韻が消えてから破棄
  setTimeout(() => {
    voice.dispose()
    panVol.dispose()
    activeVoices -= 1
  }, 2600)
}

/** ミュート切り替え（クリックノイズを避けて短くランプ）。 */
export function setMuted(next: boolean): void {
  muted = next
  if (!started) return
  Tone.getDestination().volume.rampTo(next ? -Infinity : TARGET_DB, 0.15)
}

export function isMuted(): boolean {
  return muted
}

/** タブ非表示時に CPU/バッテリーを節約しつつ音を止める。 */
export function suspendAudio(): void {
  if (!started) return
  Tone.getDestination().volume.rampTo(-Infinity, 0.4)
  Tone.getTransport().pause()
}

/** タブ復帰時に音を戻す（iOS の interrupted 対策で start も呼ぶ）。 */
export async function resumeAudio(): Promise<void> {
  if (!started) return
  await Tone.start()
  Tone.getTransport().start()
  Tone.getDestination().volume.rampTo(muted ? -Infinity : TARGET_DB, 0.4)
}
