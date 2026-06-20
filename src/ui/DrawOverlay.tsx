import { useEffect, useRef, useState } from 'react'
import { pitchToY, type Point } from '../score/drawMelody'
import type { Layer } from '../state/layers'

export type DrawOverlayProps = {
  /** 描き終わったときに点列と画面高さを渡す。 */
  onComplete: (points: Point[], height: number) => void
  onCancel: () => void
  /** すでにあるレイヤー（重ねがけ用に薄く表示）。 */
  priorLayers: Layer[]
}

/** レイヤーの音符列を、薄く表示するための折れ線（横=順番, 縦=音高）に。 */
function layerPolyline(layer: Layer, w: number, h: number): string {
  const n = layer.notes.length
  if (n < 2) return ''
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const note = layer.notes[i].note
    if (!note) continue
    const x = (i / (n - 1)) * w
    pts.push(`${x.toFixed(0)},${pitchToY(note, h).toFixed(0)}`)
  }
  return pts.join(' ')
}

/** 縦の目安（音の高さ）のガイド線。 */
const PITCH_GUIDES = [
  { f: 0.06, label: '高音' },
  { f: 0.5, label: '中音' },
  { f: 0.94, label: '低音' },
]
const PITCH_LINES = [0.2, 0.35, 0.65, 0.8]
/** 横の目安（時間）の縦ガイド線。 */
const TIME_LINES = [0.2, 0.4, 0.6, 0.8]

/**
 * 画面全体をなぞってメロディの線を描く。横＝時間、縦＝音の高さ（上が高音）。
 * 目安軸（高音/中音/低音のガイド）を表示。1 ストロークで onComplete。
 * 点の取り込みは即時、表示は rAF でまとめて更新（長い線でも軽い）。
 */
export function DrawOverlay({ onComplete, onCancel, priorLayers }: DrawOverlayProps) {
  const [pts, setPts] = useState<Point[]>([])
  const ptsRef = useRef<Point[]>([])
  const drawing = useRef(false)
  const raf = useRef(0)
  const size = useRef({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const scheduleRender = () => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      setPts(ptsRef.current.slice())
    })
  }

  const start = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    ptsRef.current = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }]
    scheduleRender()
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    ptsRef.current.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
    scheduleRender()
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    if (ptsRef.current.length >= 2) onComplete(ptsRef.current, size.current.h)
  }

  const { w, h } = size.current

  return (
    <div className="draw-overlay" onPointerDown={start} onPointerMove={move} onPointerUp={end}>
      <svg width="100%" height="100%">
        {/* 目安軸（縦＝音の高さ、横＝時間） */}
        {PITCH_LINES.map((f) => (
          <line key={`p${f}`} x1={0} y1={h * f} x2={w} y2={h * f} className="guide-line" />
        ))}
        {TIME_LINES.map((f) => (
          <line key={`t${f}`} x1={w * f} y1={0} x2={w * f} y2={h} className="guide-line" />
        ))}
        {PITCH_GUIDES.map((g) => (
          <line key={g.f} x1={0} y1={h * g.f} x2={w} y2={h * g.f} className="guide-line-main" />
        ))}
        {PITCH_GUIDES.map((g) => (
          <text key={g.label} x={14} y={h * g.f - 6} className="guide-text">
            {g.label}
          </text>
        ))}
        <text x={w - 90} y={h - 16} className="guide-text">
          時間 →
        </text>

        {/* 重ねがけ用: 既存レイヤーを薄く表示 */}
        {priorLayers.map((l) => (
          <polyline
            key={l.id}
            points={layerPolyline(l, w, h)}
            fill="none"
            stroke={l.color}
            strokeWidth={2}
            strokeOpacity={0.28}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#bfe9ff"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="draw-hint">
        左→右に線を描く（横＝時間が進む / 縦＝音の高さ）。平らに描くと穏やか・短く描くと短い曲。
      </div>
      <button className="draw-cancel" onPointerDown={(e) => e.stopPropagation()} onClick={onCancel}>
        やめる
      </button>
    </div>
  )
}
