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
 *
 * Tone.js は重いので動的 import で遅延読み込みし、初回描画を軽くする（映像はクリック前から動く）。
 */

const TARGET_DB = -10

type ToneMod = typeof import('tone')

type Engine = {
  reverb: import('tone').Reverb
  eq: import('tone').EQ3
}

let Tone: ToneMod | null = null
let engine: Engine | null = null
let started = false
let muted = false
let activeVoices = 0
let activeDropVoices = 0

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

  return { reverb, eq }
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
 * バーに着水したときに、そのバーの音を温かいマリンバで鳴らす。
 * x はシーン上の横位置（[-POND_HALF, POND_HALF]）で、左右の定位に使う。
 */
export function playNote(note: string, x: number): void {
  if (!started || !Tone || !engine) return
  if (activeVoices > 16) return // 同時発音の暴走を防ぐ
  const T = Tone

  const pan = Math.max(-1, Math.min(1, x / POND_HALF))
  const panVol = new T.PanVol(pan, 0)
  panVol.connect(engine.reverb)
  panVol.connect(engine.eq) // ドライ成分も少し

  const voice = new T.Synth({
    oscillator: { partials: [1, 0, 2, 0, 3] }, // 木質の倍音（マリンバ）
    envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1.2 },
    volume: -6,
  }).connect(panVol)
  voice.detune.value = (Math.random() * 2 - 1) * 6 // ±6 cent のゆらぎ

  const velocity = 0.5 + Math.random() * 0.4
  voice.triggerAttackRelease(note, '2n', undefined, velocity)

  activeVoices += 1
  setTimeout(() => {
    try {
      voice.dispose()
      panVol.dispose()
    } finally {
      activeVoices -= 1 // dispose が失敗してもカウンタを必ず戻す
    }
  }, 2600)
}

/**
 * 水面への着水音（リアルな「ポチャッ」）。
 * 水滴の気泡共鳴を模して、ピッチが素早く上がる正弦波＋速い減衰。
 * 滴ごとに基音と上昇量をゆらして、雨の粒立ちを出す。x で左右へ定位。
 */
export function playWaterDrop(x: number): void {
  if (!started || !Tone || !engine) return
  if (activeDropVoices > 12) return // 多発するのでやや低めに上限
  const T = Tone
  const now = T.now()

  const pan = Math.max(-1, Math.min(1, x / POND_HALF))
  const panVol = new T.PanVol(pan, -15)
  panVol.connect(engine.reverb)
  panVol.connect(engine.eq)

  const f0 = 520 + Math.random() * 440
  const voice = new T.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.04 },
    volume: -8,
  }).connect(panVol)

  voice.triggerAttackRelease(f0, 0.11, now, 0.5 + Math.random() * 0.4)
  // 着水直後にピッチが跳ね上がる ＝ 水滴特有の「ポチャ」
  voice.frequency.setValueAtTime(f0, now)
  voice.frequency.exponentialRampToValueAtTime(f0 * (1.8 + Math.random() * 0.8), now + 0.05)

  activeDropVoices += 1
  setTimeout(() => {
    try {
      voice.dispose()
      panVol.dispose()
    } finally {
      activeDropVoices -= 1
    }
  }, 400)
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
