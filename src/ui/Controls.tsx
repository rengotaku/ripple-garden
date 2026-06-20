import { useRef, useState, useSyncExternalStore } from 'react'
import { isMuted, setMuted } from '../audio/synth'
import {
  settings,
  setBarShape,
  setFallSpeed,
  setRain,
  setRainOn,
  setRangeLevel,
} from '../state/settings'
import {
  addLayer,
  getLayers,
  removeLayer,
  setLayers,
  subscribeLayers,
  toggleLayer,
} from '../state/layers'
import { levelToCount } from '../config'
import { downloadScore } from '../score/downloadScore'
import { pointsToMelody, type Point } from '../score/drawMelody'
import { exportComposition, importComposition } from '../score/melodyIO'
import { DrawOverlay } from './DrawOverlay'

/** 右＝なぞって作曲メニュー、左＝星と場の設定メニュー（別々に開閉）。 */
export function Controls() {
  const [mute, setMute] = useState(isMuted())
  const [rainOn, setRainOnState] = useState(settings.rainOn)
  const [rain, setRainState] = useState(settings.rain)
  const [range, setRangeState] = useState(settings.rangeLevel)
  const [fall, setFallState] = useState(settings.fallSpeed)
  const [circle, setCircle] = useState(settings.barShape === 'circle')
  const [drawing, setDrawing] = useState(false)
  const [composeOpen, setComposeOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scoreMsg, setScoreMsg] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const layers = useSyncExternalStore(subscribeLayers, getLayers, getLayers)

  const handleScore = async () => {
    setScoreMsg('…')
    try {
      const ok = await downloadScore()
      setScoreMsg(ok ? '✓' : '空')
    } catch {
      setScoreMsg('×')
    }
    setTimeout(() => setScoreMsg(null), 2000)
  }

  const handleDrawComplete = (points: Point[], height: number) => {
    setDrawing(false)
    const melody = pointsToMelody(points, height)
    if (melody.length) addLayer(melody)
  }

  const handleImport = async (file: File) => {
    try {
      const imported = await importComposition(file)
      if (imported.length) setLayers(imported)
    } catch {
      /* 不正なファイルは無視 */
    }
  }

  return (
    <>
      {drawing && (
        <DrawOverlay
          onComplete={handleDrawComplete}
          onCancel={() => setDrawing(false)}
          priorLayers={layers}
        />
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

      {/* ===== 右: なぞって作曲メニュー ===== */}
      {!drawing && !composeOpen && (
        <button
          className="controls-fab"
          onClick={() => setComposeOpen(true)}
          aria-label="作曲メニューを開く"
        >
          ✎
        </button>
      )}
      {!drawing && composeOpen && (
        <div className="controls">
          <button className="controls-close" onClick={() => setComposeOpen(false)} aria-label="閉じる">
            ×
          </button>

          <button className="control-toggle primary" onClick={() => setDrawing(true)}>
            ✎ なぞって作曲（旋律を追加）
          </button>

          {layers.length > 0 && (
            <div className="layer-list">
              {layers.map((l, i) => (
                <div key={l.id} className={`layer-row ${l.enabled ? '' : 'off'}`}>
                  <span className="layer-dot" style={{ background: l.color }} />
                  <span className="layer-name">旋律 {i + 1}</span>
                  <button className="layer-btn" onClick={() => toggleLayer(l.id)} aria-label="有効/無効">
                    {l.enabled ? '🔊' : '🔇'}
                  </button>
                  <button className="layer-btn" onClick={() => removeLayer(l.id)} aria-label="削除">
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="control-iorow">
            <button className="control-mini" disabled={!layers.length} onClick={() => exportComposition(getLayers())}>
              ⤓ 書き出し
            </button>
            <button className="control-mini" onClick={() => fileInput.current?.click()}>
              ⤒ 読み込み
            </button>
          </div>
        </div>
      )}

      {/* ===== 左: 星と場の設定メニュー ===== */}
      {!drawing && !settingsOpen && (
        <button
          className="controls-fab left"
          onClick={() => setSettingsOpen(true)}
          aria-label="設定メニューを開く"
        >
          ⚙
        </button>
      )}
      {!drawing && settingsOpen && (
        <div className="controls left">
          <button className="controls-close" onClick={() => setSettingsOpen(false)} aria-label="閉じる">
            ×
          </button>

          <button
            className={`control-toggle ${rainOn ? 'on' : ''}`}
            onClick={() => {
              const next = !rainOn
              setRainOn(next)
              setRainOnState(next)
            }}
          >
            {rainOn ? '✦ 星: 降っている' : '✦ 星: 停止中'}
          </button>

          <label className="control-row">
            <span className="control-label">✦ 星の量</span>
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
            <span className="control-label">💫 落下速度</span>
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

          <div className="control-iconrow">
            <button
              className="control-btn"
              onClick={() => {
                const next = !circle
                setBarShape(next ? 'circle' : 'row')
                setCircle(next)
              }}
              aria-label="配置切替"
              title={circle ? '配置: 円形' : '配置: 一列'}
            >
              {circle ? '◎' : '▭'}
            </button>
            <button className="control-btn" onClick={handleScore} aria-label="楽譜DL" title="楽譜をダウンロード">
              {scoreMsg ?? '♪'}
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
        </div>
      )}
    </>
  )
}
