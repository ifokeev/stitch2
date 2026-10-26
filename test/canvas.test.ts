import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { chromium } from '@playwright/test'
import { pinViewportHeight } from '../src/viewport.ts'

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
let dir = ''
let port = 0
let server: ReturnType<typeof spawn> | undefined
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const value = typeof address === 'object' && address ? address.port : 0
      probe.close((error) => (error ? reject(error) : resolve(value)))
    })
  })

const fixture = `<!doctype html>
<html><head>
  <meta charset="utf-8">
  <meta name="s2-screen" content="video-generator">
  <meta name="s2-version" content="v1">
  <meta name="s2-status" content="approved">
  <meta name="s2-device" content="desktop">
  <meta name="s2-frame-width" content="1280">
  <meta name="s2-frame-height" content="844">
  <title>Video generator canvas fixture</title>
  <style>
    * { box-sizing: border-box }
    html, body { margin: 0; background: #101217; color: #f8fafc; font: 24px system-ui, sans-serif }
    .generator-main { min-height: calc(100svh - 164px); display: grid; place-items: center; background: #1e293b }
    .marker { width: 240px; height: 100px; background: #ef4444; }
    .trailing { height: 3000px; padding: 80px; background: linear-gradient(#334155, #0f172a) }
  </style>
</head><body><main id="sentinel" class="generator-main"><div class="marker"></div></main><div class="trailing">Trailing content</div>
<script>window.__stitch2InitialInnerHeight = innerHeight; setTimeout(() => { const style = document.createElement('style'); style.textContent = '.dynamic-probe { position: absolute; height: 100dvh; opacity: 0; }'; document.head.append(style); const probe = document.createElement('i'); probe.id = 'dynamic-probe'; probe.className = 'dynamic-probe'; document.body.append(probe); }, 25)</script>
</body></html>`

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'stitch2-canvas-'))
  mkdirSync(join(dir, 'design/screens/video-generator'), { recursive: true })
  writeFileSync(
    join(dir, 'stitch2.config.json'),
    JSON.stringify({ name: 'canvas fixture', designDir: 'design', screenDirs: ['screens'], prefix: 's2', skills: [] }),
  )
  writeFileSync(join(dir, 'design/screens/video-generator/desktop-v1.html'), fixture)
  port = await freePort()
  server = spawn(process.execPath, [cli, 'canvas'], {
    cwd: dir,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (let i = 0; i < 100; i++) {
    const response = await fetch(`http://127.0.0.1:${port}/api/screens`).catch(() => undefined)
    if (response?.ok) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('canvas server did not start')
})

after(async () => {
  await browser?.close()
  server?.kill()
  rmSync(dir, { recursive: true, force: true })
})

test('canvas keeps a full-height desktop screen bounded and visible through zoom/remount', { concurrency: false }, async () => {
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1800, height: 900 } })
  // Seed every cache generation so stale local state cannot hide the regression.
  await page.addInitScript(() => {
    const stale = JSON.stringify({ 'screens/video-generator/desktop-v1.html@1280': 20_000 })
    localStorage.setItem('stitch2-heights', stale)
    localStorage.setItem('stitch2-heights-v2', stale)
    localStorage.setItem('stitch2-heights-v3', stale)
  })
  // Gate the first thumbnail request. The live iframe must remain visible while this response is pending.
  let releaseShot!: () => void
  let requestedShot!: () => void
  let notified = false
  const shotRequested = new Promise<void>((resolve) => { requestedShot = resolve })
  const shotGate = new Promise<void>((resolve) => { releaseShot = resolve })
  await page.route('**/api/shot**', async (route) => {
    if (new URL(route.request().url()).pathname !== '/api/shot') return route.continue()
    if (!notified) {
      notified = true
      requestedShot()
      await shotGate
    }
    await route.continue()
  })
  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.frame')
    // Fit/load can leave the frame in thumbnail mode. Select it first so the initial
    // measurements exercise the real live page rather than relying on the screenshot.
    await page.locator('.frame .label').click()
    await page.waitForFunction(() => document.querySelector('.frame')?.classList.contains('ready'))
    await Promise.race([shotRequested, page.waitForTimeout(2_000).then(() => { throw new Error('canvas did not request a thumbnail') })])

    const dimensions = await page.locator('.frame .device').evaluate((device) => {
      const box = device as HTMLElement
      const iframe = device.querySelector('iframe') as HTMLIFrameElement | null
      return { height: box.offsetHeight, width: box.offsetWidth, iframeHeight: iframe?.offsetHeight ?? 0, visible: !!iframe && getComputedStyle(iframe).visibility !== 'hidden' }
    })
    assert.equal(dimensions.width, 1280)
    assert.ok(dimensions.height >= 2900 && dimensions.height < 5000, JSON.stringify(dimensions))
    assert.equal(dimensions.iframeHeight, dimensions.height)
    assert.equal(dimensions.visible, true)
    assert.equal(
      await page.locator('.frame iframe').evaluate((iframe) => !!iframe.contentDocument?.querySelector('#sentinel .marker')),
      true,
    )
    assert.equal(
      await page.locator('.frame iframe').evaluate((iframe) => Math.round(Number.parseFloat(getComputedStyle(iframe.contentDocument!.querySelector('#dynamic-probe')!).height))),
      844,
    )
    assert.equal(
      await page.locator('.frame iframe').evaluate((iframe) => (iframe.contentWindow as typeof iframe.contentWindow & { __stitch2InitialInnerHeight?: number }).__stitch2InitialInnerHeight),
      844,
      'the live page must load at its authored viewport before canvas measurement',
    )

    // Deselect and fit while the first shot is still pending. A selected frame is intentionally pinned live;
    // after deselection the pending response is the only thing keeping the iframe mounted.
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.frame')?.classList.contains('selected'))
    await page.keyboard.press('f')
    const whileShotPending = await page.locator('.frame .device').evaluate((device) => ({
      iframe: !!device.querySelector('iframe'),
      ready: device.closest('.frame')?.classList.contains('ready'),
    }))
    assert.equal(whileShotPending.iframe, true)
    assert.equal(whileShotPending.ready, true)
    releaseShot()
    await page.waitForFunction(() => {
      const frame = document.querySelector('.frame')
      const image = frame?.querySelector('.shot') as HTMLImageElement | null
      return !!image && image.complete && image.naturalWidth > 0 && !frame?.querySelector('iframe')
    })

    const shot = await page.evaluate(async () => {
      const path = '/api/shot?path=screens/video-generator/desktop-v1.html&width=1280'
      const response = await fetch(path)
      const bytes = new Uint8Array(await response.arrayBuffer())
      const image = new Image()
      image.src = path
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('shot image did not load'))
      })
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let red = 0
      let minY = canvas.height
      let maxY = -1
      for (let y = 0; y < canvas.height; y += 4) {
        for (let x = 0; x < canvas.width; x += 4) {
          const i = (y * canvas.width + x) * 4
          if (pixels[i]! > 150 && pixels[i + 1]! < 130 && pixels[i + 2]! < 130) {
            red++
            minY = Math.min(minY, y)
            maxY = Math.max(maxY, y)
          }
        }
      }
      return {
        status: response.status,
        type: response.headers.get('content-type'),
        bytes: bytes.length,
        jpeg: bytes[0] === 0xff && bytes[1] === 0xd8,
        width: image.naturalWidth,
        height: image.naturalHeight,
        red,
        minY,
        maxY,
      }
    })
    assert.equal(shot.status, 200)
    assert.equal(shot.type, 'image/jpeg')
    assert.equal(shot.jpeg, true)
    assert.ok(shot.bytes > 10_000, JSON.stringify(shot))
    // Two pixels for each CSS pixel: at one, a laptop screen shows the picture stretched, and the text comes out soft and grainy.
    assert.equal(shot.width, 2560)
    assert.ok(Math.abs(shot.height - dimensions.height * 2) <= 4, JSON.stringify({ shot, dimensions }))
    assert.ok(shot.height >= 5800 && shot.height < 10000, JSON.stringify(shot))
    assert.ok(shot.red > 100 && shot.minY < 1800 && shot.maxY < 1800, JSON.stringify(shot))

    // Zoom back to a live view, then pan well beyond the viewport and back. This exercises
    // both thumbnail/live transitions that made frames disappear after zooming in.
    await page.keyboard.press('f')
    for (let i = 0; i < 3; i++) await page.keyboard.press('+')
    await page.waitForFunction(() => {
      const frame = document.querySelector('.frame')
      const iframe = frame?.querySelector('iframe') as HTMLIFrameElement | null
      return frame?.classList.contains('ready') && !!iframe && getComputedStyle(iframe).visibility !== 'hidden'
    })
    await page.mouse.move(1200, 500)
    await page.mouse.down()
    await page.mouse.move(-3000, 500, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(250)
    await page.mouse.move(1200, 500)
    await page.mouse.down()
    await page.mouse.move(5400, 500, { steps: 8 })
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelector('.frame')?.classList.contains('ready'))
    for (let cycle = 0; cycle < 3; cycle++) {
      // Fit puts this long frame below LIVE_ZOOM (thumbnail mode), then three zoom steps
      // bring it back live. Repeating this catches stale height growth across remounts.
      await page.keyboard.press('f')
      await page.waitForTimeout(180)
      for (let i = 0; i < 3; i++) await page.keyboard.press('+')
      await page.waitForFunction(() => document.querySelector('.frame')?.classList.contains('ready'))
      const afterRemount = await page.locator('.frame .device').evaluate((device) => ({
        height: (device as HTMLElement).offsetHeight,
        iframe: !!device.querySelector('iframe'),
        visible: getComputedStyle(device.querySelector('iframe')!).visibility !== 'hidden',
      }))
      assert.ok(afterRemount.height >= 2900 && afterRemount.height < 5000, JSON.stringify({ cycle, afterRemount }))
      assert.equal(afterRemount.iframe, true)
      assert.equal(afterRemount.visible, true)
    }
  } finally {
    await page.close()
  }
})
test('pinViewportHeight freezes viewport units but leaves quoted and unquoted URLs intact', { concurrency: false }, async () => {
  const browserInstance = browser ?? (browser = await chromium.launch())
  const page = await browserInstance.newPage({ viewport: { width: 1280, height: 844 } })
  try {
    await page.setContent(`<style>
      #units { height: 100vh; width: 100vmin; min-height: 50vmin; max-height: 25vmax; background-image: url("data:text/plain,100vh"); }
      #url { background-image: url(data:text/plain,100vh); }
    </style><div id="units"></div><div id="url"></div>`)
    const urlsBefore = await page.evaluate(() => {
      const rules = [...document.styleSheets[0]!.cssRules] as CSSStyleRule[]
      return { quoted: rules[0]!.style.backgroundImage, unquoted: rules[1]!.style.backgroundImage }
    })
    await page.evaluate(pinViewportHeight, 844)
    const initial = await page.evaluate(() => {
      const rules = [...document.styleSheets[0]!.cssRules] as CSSStyleRule[]
      const units = rules[0]!.style
      const url = rules[1]!.style
      const dynamic = document.createElement('i')
      dynamic.id = 'dynamic'
      dynamic.style.height = '100dvh'
      document.body.append(dynamic)
      return {
        height: units.height,
        width: units.width,
        minHeight: units.minHeight,
        maxHeight: units.maxHeight,
        quotedUrl: units.backgroundImage,
        unquotedUrl: url.backgroundImage,
        dynamic: dynamic.style.height,
      }
    })
    // The dynamic declaration is handled by the observer on the next animation frame.
    await page.waitForFunction(() => document.getElementById('dynamic')?.style.height === '844px')
    assert.deepEqual(initial, {
      height: '844px',
      width: '844px',
      minHeight: '422px',
      maxHeight: '320px',
      quotedUrl: urlsBefore.quoted,
      unquotedUrl: urlsBefore.unquoted,
      dynamic: '100dvh',
    })
    await page.setViewportSize({ width: 1280, height: 5000 })
    await page.waitForTimeout(50)
    assert.equal(await page.evaluate(() => document.getElementById('dynamic')!.style.height), '844px')
    const cssText = await page.evaluate(() => [...document.styleSheets[0]!.cssRules][0]!.cssText)
    assert.equal(cssText.includes('height: 100vh'), false)
    assert.equal(cssText.includes('100vh'), true)
  } finally {
    await page.close()
  }
})
