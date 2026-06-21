import { useRef, useState, useSyncExternalStore } from 'react'
import { applyVolume, isMuted, setMuted } from '../audio/synth'
import {
  settings,
  setBarShape,
  setFallSpeed,
  setRain,
  setRainOn,
  setRangeLevel,
  setVolume,
} from '../state/settings'
import {
  addLayer,
  getLayers,
  removeLayer,
  setLayerTempo,
  setLayers,
  subscribeLayers,
  toggleLayer,
  updateLayer,
} from '../state/layers'
import { levelToCount, notesForLevel } from '../config'
import { downloadScore } from '../score/downloadScore'
import { strokesToMelody, type Stroke } from '../score/drawMelody'
import { exportComposition, importComposition } from '../score/melodyIO'
import {
  ChevronsDown,
  CircleDot,
  Download,
  FileMusic,
  LayoutGrid,
  Music,
  Pencil,
  Rows3,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { DrawOverlay } from './DrawOverlay'
import { OverviewOverlay } from './OverviewOverlay'

const ICON = 16

/** 右＝なぞって作曲メニュー、左＝星と場の設定メニュー（別々に開閉）。 */
export function Controls() {
  const [mute, setMute] = useState(isMuted())
  const [rainOn, setRainOnState] = useState(settings.rainOn)
  const [rain, setRainState] = useState(settings.rain)
  const [range, setRangeState] = useState(settings.rangeLevel)
  const [fall, setFallState] = useState(settings.fallSpeed)
  const [volume, setVolumeUi] = useState(settings.volume)
  const [circle, setCircle] = useState(settings.barShape === 'circle')
  const [drawing, setDrawing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [overviewOpen, setOverviewOpen] = useState(false)
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

  const startEdit = (id: number) => {
    setOverviewOpen(false)
    setEditingId(id)
    setDrawing(true)
  }

  const closeDraw = () => {
    setDrawing(false)
    setEditingId(null)
  }

  const handleDrawComplete = (strokes: Stroke[], size: { w: number; h: number }) => {
    const melody = strokesToMelody(strokes, size.h, notesForLevel(settings.rangeLevel))
    if (!melody.length) {
      closeDraw()
      return
    }
    // 再表示で実物の線を見せるため、描いた軌跡を正規化座標で保存する。
    const norm = strokes
      .map((s) => s.map((p) => ({ x: p.x / size.w, y: p.y / size.h })))
      .filter((s) => s.length >= 2)
    if (editingId !== null) {
      // 再編集：notes を作り直し、軌跡も差し替える。色・個別テンポ・有効状態は維持。
      updateLayer(editingId, { notes: melody, strokes: norm })
    } else {
      addLayer(melody, norm) // 個別テンポは中立(0.5)。全体の速さは「時の流れ」(マスター)で効く
    }
    closeDraw()
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
          onCancel={closeDraw}
          priorLayers={editingId !== null ? layers.filter((l) => l.id !== editingId) : layers}
          initialStrokes={
            editingId !== null ? layers.find((l) => l.id === editingId)?.strokes : undefined
          }
        />
      )}

      {overviewOpen && (
        <OverviewOverlay
          layers={layers}
          onClose={() => setOverviewOpen(false)}
          onEdit={startEdit}
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
      {!drawing && !overviewOpen && !composeOpen && (
        <button
          className="controls-fab"
          onClick={() => setComposeOpen(true)}
          aria-label="作曲メニューを開く"
        >
          <Pencil size={ICON} />
        </button>
      )}
      {!drawing && !overviewOpen && composeOpen && (
        <div className="controls">
          <button className="controls-close" onClick={() => setComposeOpen(false)} aria-label="閉じる">
            <X size={ICON} />
          </button>

          <button className="control-toggle primary" onClick={() => setDrawing(true)}>
            <Pencil size={ICON} /> 星を落書き
          </button>

          {layers.length > 0 && (
            <div className="layer-list">
              {layers.map((l, i) => (
                <div key={l.id} className={`layer-row ${l.enabled ? '' : 'off'}`}>
                  <div className="layer-head">
                    <span className="layer-dot" style={{ background: l.color }} />
                    <span className="layer-name">{i + 1}</span>
                    <button className="layer-btn" onClick={() => startEdit(l.id)} aria-label="編集">
                      <Pencil size={15} />
                    </button>
                    <button className="layer-btn" onClick={() => toggleLayer(l.id)} aria-label="有効/無効">
                      {l.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    </button>
                    <button className="layer-btn" onClick={() => removeLayer(l.id)} aria-label="削除">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <label className="layer-tempo" title="この落書きの落下速度">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={l.tempo}
                      onChange={(e) => setLayerTempo(l.id, Number(e.target.value))}
                    />
                  </label>
                </div>
              ))}
            </div>
          )}

          <button
            className="control-toggle"
            disabled={!layers.length}
            onClick={() => setOverviewOpen(true)}
          >
            <LayoutGrid size={ICON} /> すべて表示
          </button>

          <div className="control-iorow">
            <button
              className="control-ico"
              disabled={!layers.length}
              onClick={() => exportComposition(getLayers())}
              aria-label="エクスポート"
              title="エクスポート"
            >
              <Download size={16} />
            </button>
            <button
              className="control-ico"
              onClick={() => fileInput.current?.click()}
              aria-label="インポート"
              title="インポート"
            >
              <Upload size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ===== 左: 星と場の設定メニュー ===== */}
      {!drawing && !overviewOpen && !settingsOpen && (
        <button
          className="controls-fab left"
          onClick={() => setSettingsOpen(true)}
          aria-label="設定メニューを開く"
        >
          <Settings size={ICON} />
        </button>
      )}
      {!drawing && !overviewOpen && settingsOpen && (
        <div className="controls left">
          <button className="controls-close" onClick={() => setSettingsOpen(false)} aria-label="閉じる">
            <X size={ICON} />
          </button>

          <button
            className={`control-toggle ${rainOn ? 'on' : ''}`}
            onClick={() => {
              const next = !rainOn
              setRainOn(next)
              setRainOnState(next)
            }}
          >
            <Sparkles size={ICON} /> {rainOn ? '星: 降っている' : '星: 停止中'}
          </button>

          <label className="control-row">
            <span className="control-label"><Sparkles size={14} /> 星の量（{Math.round(Math.max(0, (rain - 0.5) * 2) * 100)}%）</span>
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
            <span className="control-label"><Music size={14} /> 音域（{levelToCount(range)}音）</span>
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
            <span className="control-label"><ChevronsDown size={14} /> 落下速度（{Math.round(fall * 100)}%）</span>
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

          <label className="control-row">
            <span className="control-label"><Volume2 size={14} /> 音量（{Math.round(volume * 100)}%）</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value)
                setVolume(v)
                setVolumeUi(v)
                applyVolume()
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
              {circle ? <CircleDot size={ICON} /> : <Rows3 size={ICON} />}
            </button>
            <button className="control-btn" onClick={handleScore} aria-label="楽譜DL" title="楽譜をダウンロード">
              {scoreMsg ?? <FileMusic size={ICON} />}
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
              {mute ? <VolumeX size={ICON} /> : <Volume2 size={ICON} />}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
