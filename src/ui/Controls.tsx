import { useState } from 'react'
import { isMuted, setMuted } from '../audio/synth'
import { settings, setAutoSlide, setRain } from '../state/settings'

/** 右下の小さな操作パネル。雨量スライダー・自動スライド切替・ミュート。 */
export function Controls() {
  const [mute, setMute] = useState(isMuted())
  const [rain, setRainState] = useState(settings.rain)
  const [slide, setSlide] = useState(settings.autoSlide)

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
