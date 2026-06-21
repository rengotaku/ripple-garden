import { getEvents, hasRecording } from '../audio/recorder'
import { eventsToAbc } from './toAbc'

/**
 * これまでに鳴った音を五線譜（SVG）にして保存する。
 * 記譜ライブラリ abcjs はダウンロード時に動的読み込み（初回描画を軽く保つ）。
 * 戻り値 false は「まだ音が記録されていない」。
 */
export async function downloadScore(): Promise<boolean> {
  if (!hasRecording()) return false

  const abc = eventsToAbc(getEvents())
  const mod = await import('abcjs')
  const abcjs = (mod as unknown as { default?: typeof mod }).default ?? mod

  // 画面外のコンテナへ描画して SVG を取り出す。
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-99999px'
  container.style.top = '0'
  document.body.appendChild(container)

  try {
    abcjs.renderAbc(container, abc, {
      staffwidth: 760,
      scale: 1.3,
      paddingtop: 24,
      paddingbottom: 24,
      paddingleft: 24,
      paddingright: 24,
    })

    const svg = container.querySelector('svg')
    if (!svg) return false

    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const width = svg.getAttribute('width') ?? '800'
    const height = svg.getAttribute('height') ?? '600'

    // 黒い譜面が見えるよう白背景を最前面に挿入。
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('x', '0')
    bg.setAttribute('y', '0')
    bg.setAttribute('width', String(width))
    bg.setAttribute('height', String(height))
    bg.setAttribute('fill', '#ffffff')
    svg.insertBefore(bg, svg.firstChild)

    const source = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `hoshikanade-score-${timestamp()}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  } finally {
    document.body.removeChild(container)
  }
}

function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
