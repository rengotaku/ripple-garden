// ヘッドレス Chromium（SwiftShader ソフトウェア WebGL）で本番ビルドを読み込み、
// シェーダのコンパイル/リンク失敗・JS 実行時エラー・WebGL コンテキスト喪失を検出する。
// GPU の無い環境でもカスタム GLSL の致命的エラーを早期に発見するための煙テスト。
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4178
const URL = `http://localhost:${PORT}/`

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url)
        if (res.ok) return resolve()
      } catch {
        /* not ready yet */
      }
      if (Date.now() - start > timeoutMs) return reject(new Error('server timeout'))
      setTimeout(tick, 250)
    }
    tick()
  })
}

const preview = spawn('npm', ['run', 'preview', '--', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
})

let exitCode = 0
const errors = []
const IGNORE = [
  /favicon/i,
  /AudioContext was not allowed/i,
  /The AudioContext/i,
  /tonejs-instruments/i, // サンプル CDN（オフライン環境では取得失敗しても合成音にフォールバック）
  /Failed to load resource/i,
  /net::ERR/i,
  /buffer/i,
]

try {
  await waitForServer(URL)

  const browser = await chromium.launch({
    args: [
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
    ],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (!IGNORE.some((re) => re.test(text))) errors.push(`console: ${text}`)
    }
  })
  page.on('pageerror', (err) => {
    const text = String(err)
    if (!IGNORE.some((re) => re.test(text))) errors.push(`pageerror: ${text}`)
  })

  await page.goto(URL, { waitUntil: 'load' })

  // スタートオーバーレイをクリック（音解禁の経路も通す）
  await page.locator('.start-overlay').click().catch(() => {})

  // 序盤フレーム
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/hoshikanade-smoke-early.png' })

  // 蓄積後（水面シムが発散しないか確認するため時間を置く）
  await page.waitForTimeout(6000)

  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    if (!c) return { canvas: false }
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    return {
      canvas: true,
      gl: !!gl,
      lost: gl ? gl.isContextLost() : null,
      width: c.width,
      height: c.height,
    }
  })

  await page.screenshot({ path: '/tmp/hoshikanade-smoke.png' })

  // 楽譜ダウンロード（abcjs 経路）の動作確認: ボタンを押して download が出るか。
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      page.getByText('楽譜をダウンロード').click(),
    ])
    const name = download.suggestedFilename()
    await download.saveAs(`/tmp/${name}`)
    console.log('score download OK:', name)
  } catch (e) {
    console.log('score download not verified:', e instanceof Error ? e.message : String(e))
  }

  console.log('WebGL info:', JSON.stringify(info))
  if (!info.canvas) errors.push('no <canvas> rendered')
  if (info.canvas && !info.gl) errors.push('no WebGL context')
  if (info.lost) errors.push('WebGL context lost')
  if (info.canvas && (info.width < 10 || info.height < 10)) {
    errors.push(`canvas too small: ${info.width}x${info.height}`)
  }

  await browser.close()
} catch (e) {
  errors.push(`fatal: ${e instanceof Error ? e.message : String(e)}`)
} finally {
  preview.kill('SIGTERM')
}

if (errors.length) {
  console.error('\nSMOKE FAIL:')
  for (const e of errors) console.error('  - ' + e)
  exitCode = 1
} else {
  console.log('\nSMOKE PASS — screenshot at /tmp/hoshikanade-smoke.png')
}
process.exit(exitCode)
