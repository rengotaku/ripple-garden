import { useEffect, useRef, useState } from 'react'
import { Eraser, Info, Pencil } from 'lucide-react'
import type { Point, Stroke } from '../score/drawMelody'
import { layerLines } from '../score/layerLines'
import type { Layer, NormPoint } from '../state/layers'

export type DrawOverlayProps = {
  /** 「旋律完了」で全ストロークと画面サイズを渡す。 */
  onComplete: (strokes: Stroke[], size: { w: number; h: number }) => void
  onCancel: () => void
  /** すでにあるレイヤー（重ねがけ用に薄く表示）。 */
  priorLayers: Layer[]
  /** 再編集時の初期ストローク（正規化座標）。画面サイズへ戻して読み込む。 */
  initialStrokes?: NormPoint[][]
}

/** 縦の目安（音の高さ）のガイド線。上下のUI（ツール/アクション）とかぶらないよう内側に余白をとる。 */
const PITCH_GUIDES = [
  { f: 0.12, label: '高音' },
  { f: 0.5, label: '中音' },
  { f: 0.88, label: '低音' },
]
const PITCH_LINES = [0.28, 0.4, 0.6, 0.72]

/** 消しゴムでストロークを消すと判定する距離（px）。指/ポインタの近傍。 */
const ERASE_THRESHOLD = 18

type Mode = 'pen' | 'eraser'

const strokePath = (pts: Point[]): string => pts.map((p) => `${p.x},${p.y}`).join(' ')

/** 点 p と線分 a-b の距離。 */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/** 点と折れ線の最短距離。 */
function distToStroke(p: Point, stroke: Point[]): number {
  let min = Infinity
  for (let i = 0; i < stroke.length - 1; i++) {
    const d = distToSegment(p, stroke[i], stroke[i + 1])
    if (d < min) min = d
  }
  return min
}

/**
 * 画面全体に自由作画でメロディを描く。縦＝音の高さ（上が高音）。
 * 一筆書きではなく、複数本のストロークを自由に描き、「落書き完了」で確定する。
 * ・ストロークを別々に描く＝跳躍（連続音階に縛られない）／横に重ねて描く＝和音。
 * ・ペン/消しゴムを切り替えられる。消しゴムは近傍のストロークを丸ごと消す。
 * ・点の取り込みは即時、表示は rAF でまとめて更新（長い線でも軽い）。
 */
export function DrawOverlay({ onComplete, onCancel, priorLayers, initialStrokes }: DrawOverlayProps) {
  const size = useRef({ w: window.innerWidth, h: window.innerHeight })
  // 再編集時：正規化ストロークを画面座標の Point[] に戻す（t は表示専用なので連番でよい）。
  const initial = useRef<Stroke[]>(
    (initialStrokes ?? [])
      .filter((s) => s.length >= 2)
      .map((s) => s.map((p, i) => ({ x: p.x * size.current.w, y: p.y * size.current.h, t: i }))),
  )

  const [strokes, setStrokes] = useState<Stroke[]>(initial.current)
  const [current, setCurrent] = useState<Point[]>([])
  const [mode, setMode] = useState<Mode>('pen')
  const [infoOpen, setInfoOpen] = useState(false)
  const strokesRef = useRef<Stroke[]>(initial.current)
  const curRef = useRef<Point[]>([])
  const drawing = useRef(false)
  const erasing = useRef(false)
  const raf = useRef(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const scheduleRender = () => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      setCurrent(curRef.current.slice())
    })
  }

  /** 指定座標の近傍にあるストロークを消す。 */
  const eraseAt = (x: number, y: number) => {
    const p: Point = { x, y, t: 0 }
    const next = strokesRef.current.filter((s) => distToStroke(p, s) > ERASE_THRESHOLD)
    if (next.length !== strokesRef.current.length) {
      strokesRef.current = next
      setStrokes(next.slice())
    }
  }

  const start = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    if (mode === 'eraser') {
      erasing.current = true
      eraseAt(e.clientX, e.clientY)
      return
    }
    drawing.current = true
    curRef.current = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }]
    scheduleRender()
  }
  const move = (e: React.PointerEvent) => {
    if (mode === 'eraser') {
      if (erasing.current) eraseAt(e.clientX, e.clientY)
      return
    }
    if (!drawing.current) return
    curRef.current.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
    scheduleRender()
  }
  const end = () => {
    if (mode === 'eraser') {
      erasing.current = false
      return
    }
    if (!drawing.current) return
    drawing.current = false
    if (curRef.current.length >= 2) {
      strokesRef.current = [...strokesRef.current, curRef.current]
      setStrokes(strokesRef.current.slice())
    }
    curRef.current = []
    setCurrent([])
  }

  const undo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1)
    setStrokes(strokesRef.current.slice())
  }
  const complete = () => {
    if (strokesRef.current.length) onComplete(strokesRef.current, size.current)
  }

  const { w, h } = size.current
  const hasStrokes = strokes.length > 0

  return (
    <div
      className={`draw-overlay ${mode === 'eraser' ? 'erase' : ''}`}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
    >
      <svg width="100%" height="100%">
        {/* 目安軸（縦＝音の高さ） */}
        {PITCH_LINES.map((f) => (
          <line key={`p${f}`} x1={0} y1={h * f} x2={w} y2={h * f} className="guide-line" />
        ))}
        {PITCH_GUIDES.map((g) => (
          <line key={g.f} x1={0} y1={h * g.f} x2={w} y2={h * g.f} className="guide-line-main" />
        ))}
        {PITCH_GUIDES.map((g) => (
          <text key={g.label} x={14} y={h * g.f - 6} className="guide-text">
            {g.label}
          </text>
        ))}

        {/* 重ねがけ用: 既存レイヤーを薄く表示（描いた軌跡があれば実物を再表示） */}
        {priorLayers.flatMap((l) =>
          layerLines(l, w, h).map((pts, i) => (
            <polyline
              key={`${l.id}-${i}`}
              points={pts}
              fill="none"
              stroke={l.color}
              strokeWidth={2}
              strokeOpacity={0.28}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )),
        )}

        {/* 確定済みストローク */}
        {strokes.map((s, i) => (
          <polyline
            key={i}
            points={strokePath(s)}
            fill="none"
            stroke="#bfe9ff"
            strokeWidth={3}
            strokeOpacity={0.85}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {/* 描画中のストローク */}
        <polyline
          points={strokePath(current)}
          fill="none"
          stroke="#eaf4ff"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <button
        className={`draw-info ${infoOpen ? 'on' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setInfoOpen((o) => !o)}
        aria-label="使い方"
        aria-expanded={infoOpen}
      >
        <Info size={18} />
      </button>
      {infoOpen && (
        <div className="draw-hint" onPointerDown={(e) => e.stopPropagation()}>
          縦＝音の高さ（上が高音）。複数本を自由に描けます（別の線＝跳躍 / 横に重ねて描く＝和音）。消しゴムで近くの線を消せます。描けたら「落書き完了」。
        </div>
      )}

      {/* ペン / 消しゴムの切替 */}
      <div className="draw-tools" onPointerDown={(e) => e.stopPropagation()}>
        <button
          className={`draw-tool ${mode === 'pen' ? 'on' : ''}`}
          onClick={() => setMode('pen')}
          aria-label="ペン"
          aria-pressed={mode === 'pen'}
        >
          <Pencil size={16} /> ペン
        </button>
        <button
          className={`draw-tool ${mode === 'eraser' ? 'on' : ''}`}
          onClick={() => setMode('eraser')}
          aria-label="消しゴム"
          aria-pressed={mode === 'eraser'}
        >
          <Eraser size={16} /> 消しゴム
        </button>
      </div>

      <div className="draw-actions" onPointerDown={(e) => e.stopPropagation()}>
        <button className="draw-cancel" onClick={onCancel}>
          やめる
        </button>
        <button className="draw-undo" onClick={undo} disabled={!hasStrokes}>
          ひとつ戻す
        </button>
        <button className="draw-done" onClick={complete} disabled={!hasStrokes}>
          落書き完了
        </button>
      </div>
    </div>
  )
}
