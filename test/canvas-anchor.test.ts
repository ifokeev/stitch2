import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { chromium } from '@playwright/test'

test('late row heights keep the selected frame anchored without undoing a manual pan', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stitch2-anchor-'))
  const probe = createServer()
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const address = probe.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()))
  writeFileSync(join(dir, 'stitch2.config.json'), JSON.stringify({ name: 'anchor fixture', designDir: 'design', screenDirs: ['screens'], prefix: 's2', skills: [] }))
  for (const name of ['alpha', 'beta', 'gamma']) {
    mkdirSync(join(dir, 'design/screens', name), { recursive: true })
    writeFileSync(join(dir, 'design/screens', name, 'desktop-v1.html'), `<!doctype html><html><head>
      <meta name="s2-screen" content="${name}"><meta name="s2-version" content="v1"><meta name="s2-status" content="review">
      <meta name="s2-device" content="desktop"><meta name="s2-frame-width" content="1280"><meta name="s2-frame-height" content="844">
      <style>html,body{margin:0;background:#111;color:white}main{height:${name === 'alpha' ? 6000 : 844}px}</style>
      </head><body><main>${name}</main></body></html>`)
  }
  const server = spawn(process.execPath, [fileURLToPath(new URL('../src/cli.ts', import.meta.url)), 'canvas'], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' })
  const browser = await chromium.launch()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  try {
    for (let i = 0; i < 100; i++) {
      if ((await fetch(`http://127.0.0.1:${port}/api/screens`).catch(() => undefined))?.ok) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } })
    // Avoid the initial automatic fit; selection is the intentional camera position.
    await page.addInitScript(() => localStorage.setItem('stitch2-view-v2', JSON.stringify({ x: 40, y: 60, z: .4 })))
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      const alpha = url.pathname === '/screens/alpha/desktop-v1.html' || url.pathname === '/api/shot' && url.searchParams.get('path') === 'screens/alpha/desktop-v1.html'
      if (alpha) await gate
      if (url.pathname === '/api/shot') return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${alpha ? 6000 : 844}"><rect width="100%" height="100%" fill="#222"/></svg>` })
      return route.continue()
    })
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.frame')
    await page.evaluate(() => [...document.querySelectorAll('.frame')].find(node => node.querySelector('.title')?.getAttribute('title') === 'screens/gamma/desktop-v1.html')!.querySelector<HTMLElement>('.label')!.click())
    const gamma = page.locator('.frame').filter({ has: page.locator('.title[title="screens/gamma/desktop-v1.html"]') })
    await page.waitForFunction(() => document.querySelector('.frame.selected')?.classList.contains('ready'))
    const position = () => gamma.evaluate(node => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y } })
    const before = await position()
    assert(before.y >= 0 && before.y < 200, JSON.stringify(before))
    release()
    await page.waitForFunction(() => {
      const alpha = [...document.querySelectorAll('.frame')].find(node => node.querySelector('.title')?.getAttribute('title') === 'screens/alpha/desktop-v1.html')
      return Number.parseFloat((alpha?.querySelector('.device') as HTMLElement)?.style.height) === 6000
    })
    await page.waitForTimeout(100)
    const after = await position()
    assert(Math.abs(after.x - before.x) <= 1 && Math.abs(after.y - before.y) <= 1, `selected frame moved with late row height: ${JSON.stringify({ before, after })}`)

    // A deliberate pan is kept, not replaced by zoomTo's top-aligned selection.
    await page.mouse.move(1600, 800)
    await page.mouse.wheel(0, 220)
    const panned = await position()
    assert(Math.abs(panned.y - (after.y - 220)) <= 1, JSON.stringify({ after, panned }))
    // A filter relayout with no frame movement must leave that camera untouched.
    await page.locator('#search').fill('gamma')
    await page.waitForTimeout(100)
    const filtered = await position()
    assert(Math.abs(filtered.y - panned.y) <= 1, `layout undid the deliberate pan: ${JSON.stringify({ panned, filtered })}`)

    // Panning the selected frame completely away relinquishes its camera anchor.
    await page.mouse.wheel(0, 2000)
    const camera = () => page.evaluate(() => JSON.parse(localStorage.getItem('stitch2-view-v2')!))
    const away = await camera()
    await page.locator('#search').fill('')
    await page.waitForTimeout(100)
    assert.deepEqual(await camera(), away, 'an offscreen selection must not pull the camera back')

    // A relayout during pointer dragging must not rewrite the drag's origin.
    await gamma.locator('.label').evaluate(node => (node as HTMLElement).click())
    await page.mouse.move(1600, 800)
    await page.mouse.down()
    await page.mouse.move(1660, 800)
    const dragging = await camera()
    await page.evaluate(() => {
      const search = document.querySelector<HTMLInputElement>('#search')!
      search.value = 'gamma'
      search.dispatchEvent(new Event('input'))
    })
    assert.deepEqual(await camera(), dragging, 'a relayout must not interrupt an active drag')
    await page.mouse.move(1720, 800)
    await page.mouse.up()
    const dragged = await camera()
    assert(Math.abs(dragged.x - dragging.x - 60) <= 1 && dragged.y === dragging.y, JSON.stringify({ dragging, dragged }))
  } finally {
    release()
    await browser.close()
    server.kill()
    rmSync(dir, { recursive: true, force: true })
  }
})
