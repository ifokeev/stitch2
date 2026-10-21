import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { chromium } from '@playwright/test'

// Modes: app states set from the canvas sidebar on every screen's <html>, in live frames and in pictures.
const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
let dir = ''
let base = ''
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

// The page is red as a guest, green signed in and blue on the pro plan.
const screen = (name: string, auth: string) => `<!doctype html>
<html data-auth="${auth}"><head><meta charset="utf-8">
<meta name="s2-screen" content="${name}"><meta name="s2-version" content="v1"><meta name="s2-status" content="review"><meta name="s2-device" content="desktop">
<meta name="s2-frame-width" content="800"><meta name="s2-frame-height" content="400"><title>${name}</title>
<style>html, body { margin: 0 } body { height: 400px; background: #cc0000 } html[data-auth="user"] body { background: #00aa00 } html[data-plan="pro"] body { background: #0000cc }</style>
</head><body><h1>${name}</h1></body></html>`

const modes = [
  { name: 'auth', label: 'Account', values: [{ value: 'guest', label: 'Guest' }, { value: 'user', label: 'Signed in' }] },
  { name: 'Bad Name', values: ['x'] },
  { name: 'plan', attribute: 'data-plan', values: ['free', 'pro', 'free', 'bad value'] },
  { name: 'empty', values: [] },
]

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'stitch2-modes-'))
  for (const [name, auth] of [['home', 'guest'], ['account', 'user']]) {
    mkdirSync(join(dir, 'design/screens', name!), { recursive: true })
    writeFileSync(join(dir, 'design/screens', name!, 'desktop-v1.html'), screen(name!, auth!))
  }
  writeFileSync(join(dir, 'stitch2.config.json'), JSON.stringify({ name: 'modes fixture', designDir: 'design', screenDirs: ['screens'], prefix: 's2', skills: [], modes }))
  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, [cli, 'canvas'], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] })
  for (let i = 0; i < 100; i++) {
    if ((await fetch(`${base}/api/screens`).catch(() => undefined))?.ok) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('canvas server did not start')
})

after(async () => {
  await browser?.close()
  server?.kill()
  rmSync(dir, { recursive: true, force: true })
})

test('the config offers the modes that are well formed, with labels and attributes filled in', async () => {
  const config = (await (await fetch(`${base}/api/config`)).json()) as { modes: unknown }
  assert.deepEqual(config.modes, [
    { name: 'auth', label: 'Account', attribute: 'data-auth', values: [{ value: 'guest', label: 'Guest' }, { value: 'user', label: 'Signed in' }] },
    { name: 'plan', label: 'Plan', attribute: 'data-plan', values: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
  ])
})

test('pictures show the states they are asked for, and ignore the ones the config does not offer', { concurrency: false }, async () => {
  const picture = async (query = '') => {
    const response = await fetch(`${base}/api/shot?path=screens/home/desktop-v1.html&width=800${query}`)
    assert.equal(response.status, 200)
    return Buffer.from(await response.arrayBuffer())
  }
  const guest = await picture()
  const user = await picture('&mode=auth:user')
  const pro = await picture('&mode=plan:pro')
  assert.notEqual(Buffer.compare(guest, user), 0, 'signed in is not drawn like a guest')
  assert.notEqual(Buffer.compare(guest, pro), 0)
  assert.notEqual(Buffer.compare(user, pro), 0)
  const ignored = await picture('&mode=auth:admin&mode=nope:x&mode=plan:bad%20value&mode=data-auth:user&mode=auth')
  assert.equal(Buffer.compare(guest, ignored), 0, 'a state the config does not offer changes nothing')
})

test('the sidebar sets a state on every screen, restores each as drawn, remembers the pick and cycles with M', { concurrency: false }, async () => {
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1700, height: 900 } })
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#modeFilters select')
    await page.waitForFunction(() => document.querySelectorAll('.frame.ready iframe').length === 2)
    const selects = page.locator('#modeFilters select')
    assert.equal(await selects.count(), 2)
    assert.deepEqual(await selects.nth(0).locator('option').allTextContents(), ['Account: As drawn', 'Account: Guest', 'Account: Signed in'])
    assert.deepEqual(await selects.nth(1).locator('option').allTextContents(), ['Plan: As drawn', 'Plan: Free', 'Plan: Pro'])
    const state = (name: string) =>
      page.evaluate(
        (attribute) => Object.fromEntries([...document.querySelectorAll<HTMLIFrameElement>('.frame iframe')].map((f) => [new URL(f.src).pathname.split('/')[2]!, f.contentDocument!.documentElement.getAttribute(attribute)])),
        name,
      )
    assert.deepEqual(await state('data-auth'), { home: 'guest', account: 'user' }, 'as drawn: each screen keeps its own')
    assert.equal(await selects.nth(0).inputValue(), '')

    const requested = page.waitForRequest((r) => r.url().includes('/api/shot') && r.url().includes('mode=auth%3Auser'))
    await selects.nth(0).selectOption('user')
    assert.deepEqual(await state('data-auth'), { home: 'user', account: 'user' })
    await requested
    await selects.nth(0).selectOption('guest')
    assert.deepEqual(await state('data-auth'), { home: 'guest', account: 'guest' })
    await selects.nth(1).selectOption('pro')
    assert.deepEqual(await state('data-plan'), { home: 'pro', account: 'pro' })
    await selects.nth(1).selectOption('')
    assert.deepEqual(await state('data-plan'), { home: null, account: null }, 'as drawn removes what the file never had')
    await selects.nth(0).selectOption('')
    assert.deepEqual(await state('data-auth'), { home: 'guest', account: 'user' }, 'as drawn puts each screen back')

    // The pick survives a reload, and the screens come up in it.
    await selects.nth(0).selectOption('user')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.querySelectorAll('.frame.ready iframe').length === 2)
    assert.equal(await page.locator('#modeFilters select').nth(0).inputValue(), 'user')
    assert.deepEqual(await state('data-auth'), { home: 'user', account: 'user' })

    // M goes through as drawn, Guest and Signed in.
    await page.locator('#viewport').click({ position: { x: 20, y: 20 } })
    await page.keyboard.press('m')
    assert.equal(await page.locator('#modeFilters select').nth(0).inputValue(), '', 'after the last value comes as drawn')
    await page.keyboard.press('m')
    assert.equal(await page.locator('#modeFilters select').nth(0).inputValue(), 'guest')
    assert.deepEqual(await state('data-auth'), { home: 'guest', account: 'guest' })
  } finally {
    await page.close()
  }
})
