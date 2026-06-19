import { useState } from 'react'
import { startAudio } from '../audio/synth'

/**
 * ブラウザの自動再生制限を解除するための最初の 1 クリック。
 * 映像は操作なしで動くが、音だけはユーザー操作後に有効になる。
 */
export function StartOverlay() {
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  const handleStart = async () => {
    await startAudio()
    setHidden(true)
  }

  return (
    <div className="start-overlay" onClick={handleStart}>
      <div className="start-card">
        <h1>ripple garden</h1>
        <p>水滴が落ち、波紋が広がる箱庭。</p>
        <p className="start-hint">クリックして音を有効にする</p>
      </div>
    </div>
  )
}
