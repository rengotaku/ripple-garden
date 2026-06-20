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

/** 右下の操作パネル＋なぞり作曲（レイヤー）。 */
export function Controls() {
  const [mute, setMute] = useState(isMuted())
  const [rainOn, setRainOnState] = useState(settings.rainOn)
  const [rain, setRainState] = useState(settings.rain)
  const [range, setRangeState] = useState(settings.rangeLevel)
  const [fall, setFallState] = useState(settings.fallSpeed)
  const [circle, setCircle] = useState(settings.barShape === 'circle')
  const [drawing, setDrawing] = useState(false)
  const [open, setOpen] = useState(true)
  const [scoreMsg, setScoreMsg] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const layers = useSyncExternalStore(subscribeLayers, getLayers, getLayers)

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

      {!drawing && !open && (
        <button className="controls-fab" onClick={() => setOpen(true)} aria-label="メニューを開く">
          ⚙
        </button>
      )}

      {!drawing && open && (
        <div className="controls">
          <button
            className="controls-close"
            onClick={() => setOpen(false)}
            aria-label="メニューを閉じる"
          >
            ×
          </button>

          {/* なぞって作曲（メイン） */}
          <button className="control-toggle primary" onClick={() => setDrawing(true)}>
            ✎ なぞって作曲（旋律を追加）
          </button>

          {layers.length > 0 && (
            <div className="layer-list">
              {layers.map((l, i) => (
                <div key={l.id} className={`layer-row ${l.enabled ? '' : 'off'}`}>
                  <span className="layer-dot" style={{ background: l.color }} />
                  <span className="layer-name">旋律 {i + 1}</span>
                  <button
                    className="layer-btn"
                    onClick={() => toggleLayer(l.id)}
                    aria-label={l.enabled ? '無効化' : '有効化'}
                  >
                    {l.enabled ? '🔊' : '🔇'}
                  </button>
                  <button
                    className="layer-btn"
                    onClick={() => removeLayer(l.id)}
                    aria-label="削除"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="control-iorow">
            <button
              className="control-mini"
              disabled={!layers.length}
              onClick={() => exportComposition(getLayers())}
            >
              ⤓ 書き出し
            </button>
            <button className="control-mini" onClick={() => fileInput.current?.click()}>
              ⤒ 読み込み
            </button>
          </div>

          <hr className="control-sep" />

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
      )}
    </>
  )
}
