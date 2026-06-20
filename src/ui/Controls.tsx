import { useState } from 'react'
import { isMuted, setMuted } from '../audio/synth'
import { settings, setAutoSlide, setFallSpeed, setRain, setRangeLevel } from '../state/settings'
import { levelToCount } from '../config'
import { downloadScore } from '../score/downloadScore'

/** 右下の小さな操作パネル。雨量・音域・落下速度スライダー・自動スライド・楽譜DL・ミュート。 */
export function Controls() {
  const [mute, setMute] = useState(isMuted())
  const [rain, setRainState] = useState(settings.rain)
  const [range, setRangeState] = useState(settings.rangeLevel)
  const [fall, setFallState] = useState(settings.fallSpeed)
  const [slide, setSlide] = useState(settings.autoSlide)
  const [scoreMsg, setScoreMsg] = useState<string | null>(null)

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

  return (
    <div className="controls">
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
        className={`control-toggle ${slide ? 'on' : ''}`}
        onClick={() => {
          const next = !slide
          setAutoSlide(next)
          setSlide(next)
        }}
      >
        {slide ? '◇ 自動スライド: ON' : '◇ 自動スライド: OFF'}
      </button>

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
  )
}
