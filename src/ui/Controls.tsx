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
  appendSection,
  getLayers,
  getSections,
  removeLayer,
  removeSection,
  replaceSection,
  sectionSlice,
  setLayerTempo,
  setLayers,
  subscribeLayers,
  toggleLayer,
} from '../state/layers'
import type { SongNote } from '../audio/songs'
import { levelToCount, notesForLevel, PITCH_POOL } from '../config'
import { downloadScore } from '../score/downloadScore'
import { strokesToMelody, type Stroke } from '../score/drawMelody'
import { exportComposition, importComposition } from '../score/melodyIO'
import {
  ChevronsDown,
  CircleDot,
  Download,
  FileMusic,
  LayoutGrid,
  Lock,
  Music,
  Pencil,
  Plus,
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

/** 小節カードのミニ輪郭（音高の上下）のサイズ。 */
const SPARK_W = 38
const SPARK_H = 16

/** 小節の音符列を、音高の輪郭（SVG polyline points）に変換する。和音は先頭音を代表とする。 */
function sparkPoints(notes: SongNote[]): string {
  const n = notes.length
  if (n < 1) return ''
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const note = notes[i].notes[0]
    if (!note) continue
    const idx = PITCH_POOL.indexOf(note)
    const frac = idx >= 0 ? idx / (PITCH_POOL.length - 1) : 0.5
    const x = n > 1 ? (i / (n - 1)) * SPARK_W : SPARK_W / 2
    const y = SPARK_H - frac * SPARK_H // 高音ほど上
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

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
  // 小節編集の対象（レイヤーid＋小節index）。append は末尾追加なので index は持たない。
  const [editTarget, setEditTarget] = useState<{ id: number; index: number } | null>(null)
  const [appendId, setAppendId] = useState<number | null>(null)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scoreMsg, setScoreMsg] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const layers = useSyncExternalStore(subscribeLayers, getLayers, getLayers)
  // 落書きの音は描いた時点の音域でバーへマップされるため、1つでもあれば音域を固定する。
  const rangeLocked = layers.length > 0

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

  const startEditSection = (id: number, index: number) => {
    setOverviewOpen(false)
    setEditTarget({ id, index })
    setDrawing(true)
  }

  const startAppend = (id: number) => {
    setAppendId(id)
    setDrawing(true)
  }

  const closeDraw = () => {
    setDrawing(false)
    setEditTarget(null)
    setAppendId(null)
  }

  const handleDrawComplete = (strokes: Stroke[], size: { w: number; h: number }) => {
    const melody = strokesToMelody(strokes, size.w, size.h, notesForLevel(settings.rangeLevel))
    if (!melody.length) {
      closeDraw()
      return
    }
    // 再表示で実物の線を見せるため、描いた軌跡を正規化座標で保存する。
    const norm = strokes
      .map((s) => s.map((p) => ({ x: p.x / size.w, y: p.y / size.h })))
      .filter((s) => s.length >= 2)
    if (editTarget !== null) {
      // 小節を描き直す：その小節だけ差し替える（色・個別テンポ・有効状態は維持）。
      replaceSection(editTarget.id, editTarget.index, melody, norm)
    } else if (appendId !== null) {
      // 小節を継ぎ足す：対象レイヤーの旋律末尾へ連結し、1つの長いメロディにする。
      appendSection(appendId, melody, norm)
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
          priorLayers={editTarget !== null ? layers.filter((l) => l.id !== editTarget.id) : layers}
          initialStrokes={
            editTarget !== null
              ? (() => {
                  const l = layers.find((x) => x.id === editTarget.id)
                  return l ? sectionSlice(l, editTarget.index).strokes : undefined
                })()
              : undefined
          }
        />
      )}

      {overviewOpen && (
        <OverviewOverlay
          layers={layers}
          onClose={() => setOverviewOpen(false)}
          onEdit={(id) => startEditSection(id, 0)}
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
                    <button className="layer-btn" onClick={() => toggleLayer(l.id)} aria-label="有効/無効">
                      {l.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    </button>
                    <button className="layer-btn" onClick={() => removeLayer(l.id)} aria-label="削除">
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* 小節カード：タップで描き直し、× で削除、＋ で末尾に小節追加 */}
                  <div className="section-cards">
                    {getSections(l).map((_, idx) => (
                      <span key={`${l.id}-${idx}`} className="section-card-wrap">
                        <button
                          className="section-card"
                          style={{ borderColor: l.color }}
                          onClick={() => startEditSection(l.id, idx)}
                          title={`小節${idx + 1}を描き直す`}
                          aria-label={`小節${idx + 1}を描き直す`}
                        >
                          <span className="section-num">{idx + 1}</span>
                          <svg
                            className="section-spark"
                            width={SPARK_W}
                            height={SPARK_H}
                            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                            aria-hidden="true"
                          >
                            <polyline
                              points={sparkPoints(sectionSlice(l, idx).notes)}
                              fill="none"
                              stroke={l.color}
                              strokeWidth={1.5}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                        <button
                          className="section-del"
                          onClick={() => removeSection(l.id, idx)}
                          aria-label={`小節${idx + 1}を削除`}
                          title="この小節を削除"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    <button
                      className="section-add"
                      onClick={() => startAppend(l.id)}
                      aria-label="小節を追加"
                      title="小節を追加（空のキャンバスに描く）"
                    >
                      <Plus size={14} />
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
            {/* 表示はつまみ位置そのまま（既定=中央=50%）。実効量は中央=0（RainSystem で remap）。 */}
            <span className="control-label"><Sparkles size={14} /> 星の量（{Math.round(rain * 100)}%）</span>
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

          <label className={`control-row ${rangeLocked ? 'locked' : ''}`}>
            <span className="control-label">
              <Music size={14} /> 音域（{levelToCount(range)}音）
              {rangeLocked && <Lock size={12} className="control-lock" />}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={range}
              disabled={rangeLocked}
              onChange={(e) => {
                const v = Number(e.target.value)
                setRangeLevel(v)
                setRangeState(v)
              }}
            />
            {rangeLocked && (
              <span className="control-hint">落書きがある間は音域を固定します（全削除でロック解除）</span>
            )}
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
