import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { chromium } from '@playwright/test'

// How tall the canvas draws a live screen: as tall as the page, also when the page gets taller after it loaded (a table that fetches its rows, an
// image that arrives), and also when the page rewrites its own address (a table that keeps its state in the query).
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

const page = (name: string, title: string, body: string, script: string) => '<!doctype html><html><head><meta charset="utf-8">'
  + '<meta name="s2-screen" content="' + name + '"><meta name="s2-version" content="v1"><meta name="s2-device" content="mobile">'
  + '<meta name="s2-frame-width" content="390"><meta name="s2-frame-height" content="844"><title>' + title + '</title>'
  + '<style>body{margin:0;background:#101217;color:#f8fafc;font:24px system-ui}</style></head><body>' + body + '<script>' + script + '</script></body></html>'

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'stitch2-measure-'))
  mkdirSync(join(dir, 'design/screens/grows'), { recursive: true })
  mkdirSync(join(dir, 'design/screens/rewrites'), { recursive: true })
  writeFileSync(
    join(dir, 'stitch2.config.json'),
    JSON.stringify({ name: 'measure fixture', designDir: 'design', screenDirs: ['screens'], prefix: 's2', skills: [] }),
  )
  // 600px tall when it loads, 2400px tall three and a half seconds later: after every moment the canvas used to measure at.
  writeFileSync(join(dir, 'design/screens/grows/mobile-v1.html'), page('grows', 'Grows late', '<main id="m" style="height:600px">Grows</main>', 'setTimeout(function(){document.getElementById("m").style.height="2400px"},3500)'))
  // 1500px tall, and it rewrites its own query as soon as it runs.
  writeFileSync(join(dir, 'design/screens/rewrites/mobile-v1.html'), page('rewrites', 'Rewrites its address', '<main style="height:1500px">Rewrites</main>', 'history.replaceState(null,"",location.pathname+"?seen=1")'))
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

// The frame is drawn at the height of its device box; a frame shorter than its page cuts the page off. It runs in the page, so it takes the title as an argument.
const heightOf = (frames: Element[], title: string) => {
  const frame = frames.find((node) => node.textContent?.includes(title))
  return frame ? { height: parseFloat((frame.querySelector('.device') as HTMLElement).style.height), ready: frame.classList.contains('ready') } : { height: 0, ready: false }
}

async function openLive(title: string) {
  browser ??= await chromium.launch()
  const tab = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await tab.goto('http://127.0.0.1:' + port + '/')
  await tab.waitForFunction(() => document.querySelectorAll('.frame').length === 2)
  await tab.locator('.frame', { hasText: title }).locator('.label').click()
  return tab
}

test('a live frame follows its page when the page gets taller after it loaded', { concurrency: false, timeout: 60_000 }, async () => {
  const tab = await openLive('Grows late')
  const read = () => tab.locator('.frame').evaluateAll(heightOf, 'Grows late')
  await tab.waitForFunction(() => [...document.querySelectorAll('.frame')].some((frame) => frame.textContent?.includes('Grows late') && frame.classList.contains('ready')), undefined, { timeout: 15_000 })
  const early = await read()
  assert(early.height < 2400, 'before the page grows the frame is ' + early.height + 'px')
  await tab.waitForTimeout(5000)
  const late = await read()
  assert(late.height >= 2400, 'the page is 2400px tall and the frame is ' + late.height + 'px')
  await tab.close()
})

test('a page that rewrites its own query is still measured and shown', { concurrency: false, timeout: 60_000 }, async () => {
  const tab = await openLive('Rewrites its address')
  await tab.waitForFunction(() => [...document.querySelectorAll('.frame')].some((frame) => frame.textContent?.includes('Rewrites its address') && frame.classList.contains('ready')), undefined, { timeout: 15_000 })
  const frame = await tab.locator('.frame').evaluateAll(heightOf, 'Rewrites its address')
  assert(frame.height >= 1500, 'the page is 1500px tall and the frame is ' + frame.height + 'px')
  await tab.close()
})
