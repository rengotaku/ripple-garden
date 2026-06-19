import { useEffect, useState } from 'react'
import { Scene } from './scene/Scene'
import { StartOverlay } from './ui/StartOverlay'
import { Controls } from './ui/Controls'
import { resumeAudio, suspendAudio } from './audio/synth'

export default function App() {
  const [started, setStarted] = useState(false)

  // タブ非表示で音を止め、復帰で戻す（モバイルの省電力／iOS interrupted 対策）。
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        suspendAudio()
      } else {
        void resumeAudio()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <div className="app">
      <Scene />
      {started && <Controls />}
      <StartOverlay onStart={() => setStarted(true)} />
    </div>
  )
}
