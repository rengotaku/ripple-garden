import { useState } from 'react'
import { isMuted, setMuted } from '../audio/synth'

/** 右下の小さなミュート切り替え。放置の邪魔をしない控えめな UI。 */
export function Controls() {
  const [mute, setMute] = useState(isMuted())

  const toggle = () => {
    const next = !mute
    setMuted(next)
    setMute(next)
  }

  return (
    <button className="control-btn" onClick={toggle} aria-label={mute ? '音を出す' : 'ミュート'}>
      {mute ? '🔇' : '🔊'}
    </button>
  )
}
