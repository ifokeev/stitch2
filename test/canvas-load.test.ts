import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { chromium } from '@playwright/test'

// What the canvas costs the machine: a picture of a screen is a whole page render on the server, so it must not ask for hundreds of them
// (fit-all, or after approving a version relinked every screen), and a link to a folder that is not there must not stop the server.
const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
const SCREENS = 240
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

const page = (n: number) => '<!doctype html><html><head><meta charset="utf-8">'
  + '<meta name="s2-screen" content="screen-' + n + '"><meta name="s2-version" content="v1"><meta name="s2-device" content="mobile">'
  + '<meta name="s2-frame-width" content="390"><meta name="s2-frame-height" content="844"><title>Screen ' + n + '</title>'
  + '<style>body{margin:0;background:#101217;color:#f8fafc;font:24px system-ui}</style></head><body><main>Screen ' + n + '</main></body></html>'

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'stitch2-load-'))
  mkdirSync(join(dir, 'design/screens'), { recursive: true })
  writeFileSync(
    join(dir, 'stitch2.config.json'),
    JSON.stringify({ name: 'load fixture', designDir: 'design', screenDirs: ['screens'], prefix: 's2', skills: [] }),
  )
  for (let n = 1; n <= SCREENS; n++) {
    mkdirSync(join(dir, 'design/screens/screen-' + n), { recursive: true })
    writeFileSync(join(dir, 'design/screens/screen-' + n + '/mobile-v1.html'), page(n))
  }
  // A project that links a folder which is not there on this machine (the previews of the app, say).
  symlinkSync('../nowhere/previews', join(dir, 'design/previews'))
  port = await freePort()
  server = spawn(process.execPath, [cli, 'canvas'], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] })
  for (let i = 0; i < 100; i++) {
    const response = await fetch('http://127.0.0.1:' + port + '/api/screens').catch(() => undefined)
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

test('a canvas fitted to hundreds of screens asks for no pictures, and only the nearest few once zoomed in', { concurrency: false, timeout: 120_000 }, async () => {
  browser = await chromium.launch()
  const tab = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const asked: string[] = []
  tab.on('request', (request) => { if (request.url().includes('/api/shot')) asked.push(request.url()) })
  await tab.goto('http://127.0.0.1:' + port + '/')
  await tab.waitForFunction((count) => document.querySelectorAll('.frame').length === count, SCREENS)
  await tab.getByRole('button', { name: 'Fit' }).click()
  await tab.waitForTimeout(2500)
  const zoom = Number((await tab.locator('#zoom').textContent())?.replace('%', ''))
  assert(zoom > 0 && zoom * 3.9 < 64, 'every frame is too small to read at ' + zoom + '%')
  // The first screenful was asked for before the canvas was fitted; from here on nothing is.
  asked.length = 0
  await tab.waitForTimeout(2500)
  assert.equal(asked.length, 0, 'no picture is asked for at ' + zoom + '%: ' + asked.length)
  // Zoom in on the middle until the frames can be read (one wheel step of 100 is a factor of 2.7): now pictures are asked for, those in view only.
  // The frames stand in a column, a row to a screen: zoom in on one in the middle of it.
  const middle = (await tab.locator('.frame').nth(SCREENS / 2).boundingBox())!
  await tab.mouse.move(middle.x + middle.width / 2, middle.y + middle.height / 2)
  await tab.keyboard.down('Control')
  for (const step of [-100, -100, -60]) { await tab.mouse.wheel(0, step); await tab.waitForTimeout(120) }
  await tab.keyboard.up('Control')
  await tab.waitForTimeout(3000)
  const readable = Number((await tab.locator('#zoom').textContent())?.replace('%', ''))
  assert(readable * 3.9 >= 64 && readable < 100, 'zoomed in to ' + readable + '%')
  assert(asked.length > 0, 'pictures are asked for once frames can be read')
  assert(asked.length < SCREENS / 2, 'only the pictures in view are asked for, not ' + asked.length + ' of ' + SCREENS)
})

test('a link to a folder that is not there does not stop the server when a picture is asked for', { concurrency: false, timeout: 60_000 }, async () => {
  const response = await fetch('http://127.0.0.1:' + port + '/api/shot?path=' + encodeURIComponent('screens/screen-1/mobile-v1.html') + '&width=390')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/jpeg')
  const alive = await fetch('http://127.0.0.1:' + port + '/api/screens')
  assert(alive.ok, 'the canvas still answers')
})

