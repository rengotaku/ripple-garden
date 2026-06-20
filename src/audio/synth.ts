import { POND_HALF } from '../config'
import { recordNote } from './recorder'

/**
 * 放置系アンビエントのための音響エンジン。
 *
 * 設計:
 * - バー音は「本物の木琴サンプル」(Tone.Sampler) で鳴らし、電子音っぽさを避ける。
 *   サンプルの読み込みに失敗した場合のみ、合成音にフォールバックする。
 * - 下に薄いアンビエント・パッド（fat オシレータ＋極低速 LFO ローパス）を流し続ける。
 * - マスターチェーン: Reverb → EQ3 → Compressor → Limiter → Destination。
 * - 解禁は最初のクリックで Tone.start()。音量はゆるやかにフェードイン。Limiter で安全。
 *
 * Tone.js は重いので動的 import で遅延読み込みし、初回描画を軽くする（映像はクリック前から動く）。
 */

const TARGET_DB = -10

/** 木琴サンプル（nbrosowsky/tonejs-instruments）。 */
const XYLO_BASE_URL = 'https://nbrosowsky.github.io/tonejs-instruments/samples/xylophone/'
const XYLO_URLS: Record<string, string> = {
  G4: 'G4.mp3',
  C5: 'C5.mp3',
  G5: 'G5.mp3',
  C6: 'C6.mp3',
  G6: 'G6.mp3',
  C7: 'C7.mp3',
  G7: 'G7.mp3',
  C8: 'C8.mp3',
}

type ToneMod = typeof import('tone')

type Engine = {
  reverb: import('tone').Reverb
  eq: import('tone').EQ3
  sampler: import('tone').Sampler
}

let Tone: ToneMod | null = null
let engine: Engine | null = null
let started = false
let muted = false
let activeVoices = 0
let samplerReady = false

async function loadTone(): Promise<ToneMod> {
  if (!Tone) Tone = await import('tone')
  return Tone
}

/** マスターチェーンとアンビエント・パッドを構築する。 */
function buildEngine(T: ToneMod): Engine {
  const limiter = new T.Limiter(-1).toDestination()
  const comp = new T.Compressor({
    threshold: -22,
    ratio: 3,
    attack: 0.05,
    release: 0.25,
  }).connect(limiter)
  const eq = new T.EQ3({ low: -1, mid: 0, high: 1.5 }).connect(comp)
  const reverb = new T.Reverb({ decay: 5, preDelay: 0.08, wet: 0.42 }).connect(eq)

  // --- アンビエント・パッド（薄いドローン） ---
  const padFilter = new T.Filter({
    type: 'lowpass',
    frequency: 600,
    rolloff: -24,
    Q: 0.8,
  }).connect(reverb)
  const padLfo = new T.LFO(0.04, 260, 1100) // 0.04Hz の極低速スイープ
  padLfo.connect(padFilter.frequency)
  padLfo.start()

  const pad = new T.PolySynth(T.Synth, {
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
  const padLoop = new T.Loop((time) => {
    pad.releaseAll(time)
    pad.triggerAttack(padChords[chordIdx % padChords.length], time + 0.05)
    chordIdx += 1
  }, 19) // 19 秒周期（素数寄りで他と噛み合わせない）
  padLoop.start(0)

  // --- 木琴サンプラー（本物のアコースティック音）。ドライ＋リバーブへ。 ---
  samplerReady = false
  const sampler = new T.Sampler({
    urls: XYLO_URLS,
    baseUrl: XYLO_BASE_URL,
    release: 0.9,
    volume: -3,
    onload: () => {
      samplerReady = true
    },
  })
  sampler.connect(eq)
  sampler.connect(reverb)

  return { reverb, eq, sampler }
}

/** ユーザー操作（クリック）後に呼ぶ。AudioContext を起動し、音を立ち上げる。 */
export async function startAudio(): Promise<void> {
  if (started) return
  const T = await loadTone()
  await T.start()
  engine = buildEngine(T)
  await engine.reverb.ready

  T.getDestination().volume.value = -Infinity
  T.getTransport().start()
  started = true
  T.getDestination().volume.rampTo(TARGET_DB, 3) // ゆるやかにフェードイン
}

/**
 * バーに着水したときに、そのバーの音を鳴らす。
 * 通常は本物の木琴サンプルで発音。サンプル未読込のときだけ合成音にフォールバック。
 * x はシーン上の横位置（[-POND_HALF, POND_HALF]）で、左右の定位に使う（合成音側）。
 */
export function playNote(note: string, x: number): void {
  if (!started || !Tone || !engine) return
  const T = Tone

  recordNote(note, T.now()) // 楽譜書き出し用に記録

  const velocity = 0.55 + Math.random() * 0.4

  // 本命: アコースティックな木琴サンプル（ポリフォニックに自動でボイス管理）。
  if (samplerReady) {
    engine.sampler.triggerAttackRelease(note, '4n', undefined, velocity)
    return
  }

  // フォールバック: 合成の木琴系音（サンプル読み込み前/失敗時）。
  if (activeVoices > 16) return
  const pan = Math.max(-1, Math.min(1, x / POND_HALF))
  const panVol = new T.PanVol(pan, 0)
  panVol.connect(engine.reverb)
  panVol.connect(engine.eq)

  const voice = new T.Synth({
    oscillator: { partials: [1, 0, 0.7, 0, 0, 0.3] },
    envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 },
    volume: -6,
  }).connect(panVol)
  voice.detune.value = (Math.random() * 2 - 1) * 5

  voice.triggerAttackRelease(note, '8n', undefined, velocity)

  activeVoices += 1
  setTimeout(() => {
    try {
      voice.dispose()
      panVol.dispose()
    } finally {
      activeVoices -= 1
    }
  }, 1200)
}

/** ミュート切り替え（クリックノイズを避けて短くランプ）。 */
export function setMuted(next: boolean): void {
  muted = next
  if (!started || !Tone) return
  Tone.getDestination().volume.rampTo(next ? -Infinity : TARGET_DB, 0.15)
}

export function isMuted(): boolean {
  return muted
}

/** タブ非表示時に CPU/バッテリーを節約しつつ音を止める。 */
export function suspendAudio(): void {
  if (!started || !Tone) return
  Tone.getDestination().volume.rampTo(-Infinity, 0.4)
  Tone.getTransport().pause()
}

/** タブ復帰時に音を戻す（iOS の interrupted 対策で start も呼ぶ）。 */
export async function resumeAudio(): Promise<void> {
  if (!started || !Tone) return
  await Tone.start()
  Tone.getTransport().start()
  Tone.getDestination().volume.rampTo(muted ? -Infinity : TARGET_DB, 0.4)
}
