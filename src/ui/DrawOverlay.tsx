import { useRef, useState } from 'react'
import type { Point } from '../score/drawMelody'

export type DrawOverlayProps = {
  /** 描き終わったときに点列と画面高さを渡す。 */
  onComplete: (points: Point[], height: number) => void
  onCancel: () => void
}

/**
 * 画面全体をなぞってメロディの線を描く。横＝時間、縦＝音の高さ（上が高音）。
 * 1 ストロークを描き終えると onComplete でメロディ化する。
 */
export function DrawOverlay({ onComplete, onCancel }: DrawOverlayProps) {
  const [pts, setPts] = useState<Point[]>([])
  const ptsRef = useRef<Point[]>([])
  const drawing = useRef(false)
  const size = useRef({ w: window.innerWidth, h: window.innerHeight })

  const start = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = [{ x: e.clientX, y: e.clientY }]
    ptsRef.current = p
    setPts(p)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    ptsRef.current = [...ptsRef.current, { x: e.clientX, y: e.clientY }]
    setPts(ptsRef.current)
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    if (ptsRef.current.length >= 2) {
      onComplete(ptsRef.current, size.current.h)
    }
  }

  return (
    <div
      className="draw-overlay"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
    >
      <svg width="100%" height="100%">
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
        指やマウスで線を描く（横＝時間 / 上が高音・下が低音）
      </div>
      <button
        className="draw-cancel"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onCancel}
      >
        やめる
      </button>
    </div>
  )
}
