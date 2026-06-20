import { useEffect } from 'react'
import { Scene } from './scene/Scene'
import { TitleOverlay } from './ui/TitleOverlay'
import { Controls } from './ui/Controls'
import { resumeAudio, startAudio, suspendAudio } from './audio/synth'

export default function App() {
  // 最初のクリック（画面のどこでも）で音声を解禁する（ブラウザの自動再生制限対策）。
  // 案内トーストは出さない（既定では音が鳴らずユーザーが混乱するため、黙って解禁する）。
  useEffect(() => {
    const onFirst = () => {
      void startAudio()
    }
    window.addEventListener('pointerdown', onFirst, { once: true })
    return () => window.removeEventListener('pointerdown', onFirst)
  }, [])

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
      <Controls />
      <TitleOverlay />
    </div>
  )
}
