import { Scene } from './scene/Scene'
import { StartOverlay } from './ui/StartOverlay'

export default function App() {
  return (
    <div className="app">
      <Scene />
      <StartOverlay />
    </div>
  )
}
