import { useRef, useState } from 'react'
import { isMuted, setMuted } from '../audio/synth'
import {
  settings,
  setBarShape,
  setCustomMelody,
  setFallSpeed,
  setRain,
  setRainOn,
  setRangeLevel,
  setSong,
} from '../state/settings'
import { levelToCount } from '../config'
import { SONG_LIST } from '../audio/songs'
import { downloadScore } from '../score/downloadScore'
import { pointsToMelody, type Point } from '../score/drawMelody'
import { exportMelody, importMelody } from '../score/melodyIO'
import { DrawOverlay } from './DrawOverlay'

/** 右下の操作パネル＋なぞり作曲オーバーレイ。 */
export function Controls() {
  const [mute, setMute] = useState(isMuted())
  const [rainOn, setRainOnState] = useState(settings.rainOn)
  const [rain, setRainState] = useState(settings.rain)
  const [range, setRangeState] = useState(settings.rangeLevel)
  const [fall, setFallState] = useState(settings.fallSpeed)
  const [circle, setCircle] = useState(settings.barShape === 'circle')
  const [song, setSongState] = useState(settings.song)
  const [hasCustom, setHasCustom] = useState(settings.customMelody != null)
  const [drawing, setDrawing] = useState(false)
  const [scoreMsg, setScoreMsg] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const handleScore = async () => {
    setScoreMsg('生成中…')
    try {
      const ok = await downloadScore()
      setScoreMsg(ok ? '保存しました' : 'まだ音がありません')
    } catch {
      setScoreMsg('生成に失敗しました')
    }
    setTimeout(() => setScoreMsg(null), 2500)
  }

  const applyCustom = () => {
    setHasCustom(true)
    setSong('custom')
    setSongState('custom')
  }

  const handleDrawComplete = (points: Point[], height: number) => {
    const melody = pointsToMelody(points, height)
    setDrawing(false)
    if (melody.length) {
      setCustomMelody(melody)
      applyCustom()
    }
  }

  const handleImport = async (file: File) => {
    try {
      const melody = await importMelody(file)
      if (melody.length) {
        setCustomMelody(melody)
        applyCustom()
      }
    } catch {
      /* 不正なファイルは無視 */
    }
  }

  return (
    <>
      {drawing && (
        <DrawOverlay onComplete={handleDrawComplete} onCancel={() => setDrawing(false)} />
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleImport(f)
          e.target.value = ''
        }}
      />

      <div className="controls">
        <button
          className={`control-toggle ${rainOn ? 'on' : ''}`}
          onClick={() => {
            const next = !rainOn
            setRainOn(next)
            setRainOnState(next)
          }}
        >
          {rainOn ? '🌧 雨: 降っている' : '⏸ 雨: 停止中'}
        </button>

        <label className="control-row">
          <span className="control-label">☔ 雨量</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={rain}
            onChange={(e) => {
              const v = Number(e.target.value)
              setRain(v)
              setRainState(v)
            }}
          />
        </label>

        <label className="control-row">
          <span className="control-label">🎵 音域（{levelToCount(range)}音）</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={range}
            onChange={(e) => {
              const v = Number(e.target.value)
              setRangeLevel(v)
              setRangeState(v)
            }}
          />
        </label>

        <label className="control-row">
          <span className="control-label">💧 落下速度</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={fall}
            onChange={(e) => {
              const v = Number(e.target.value)
              setFallSpeed(v)
              setFallState(v)
            }}
          />
        </label>

        <button
          className={`control-toggle ${circle ? 'on' : ''}`}
          onClick={() => {
            const next = !circle
            setBarShape(next ? 'circle' : 'row')
            setCircle(next)
          }}
        >
          {circle ? '◎ 配置: 円形' : '▭ 配置: 一列'}
        </button>

        <label className="control-row">
          <span className="control-label">♬ 演奏する曲</span>
          <select
            className="control-select"
            value={song}
            onChange={(e) => {
              setSong(e.target.value)
              setSongState(e.target.value)
            }}
          >
            <option value="">ランダム（生成）</option>
            {hasCustom && <option value="custom">★ なぞり作曲</option>}
            {SONG_LIST.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <button className="control-toggle" onClick={() => setDrawing(true)}>
          ✎ なぞって作曲
        </button>

        <div className="control-iorow">
          <button
            className="control-mini"
            disabled={!hasCustom}
            onClick={() => settings.customMelody && exportMelody(settings.customMelody)}
          >
            ⤓ 書き出し
          </button>
          <button className="control-mini" onClick={() => fileInput.current?.click()}>
            ⤒ 読み込み
          </button>
        </div>

        <button className="control-toggle" onClick={handleScore}>
          {scoreMsg ?? '♪ 楽譜をダウンロード'}
        </button>

        <button
          className="control-btn"
          onClick={() => {
            const next = !mute
            setMuted(next)
            setMute(next)
          }}
          aria-label={mute ? '音を出す' : 'ミュート'}
        >
          {mute ? '🔇' : '🔊'}
        </button>
      </div>
    </>
  )
}
