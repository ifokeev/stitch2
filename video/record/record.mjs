#!/usr/bin/env node
// Records the canvas clips for the product video, on a scratch copy of examples/gymgym with the real canvas and
// CLI from this repository. Writes public/clips/<clip>.mp4 with <clip>.json (cursor path and marks, in seconds),
// and public/terminal.json (real command output for the terminal scenes).
// Usage (from video/): node record/record.mjs [clip…]   Needs ffmpeg and Chromium for Playwright.
import { chromium } from '@playwright/test'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const CLI = join(REPO, 'src/cli.ts')
const OUT = resolve(import.meta.dirname, '../public/clips')
const W = 1600, H = 900, SCALE = 1.2, PORT = 4466
const URL = `http://127.0.0.1:${PORT}`
const only = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

// ---- the film set: a scratch copy of the example ----
const film = mkdtempSync(join(tmpdir(), 'stitch2-film-'))
const project = join(film, 'gymgym')
cpSync(join(REPO, 'examples/gymgym'), project, { recursive: true })
const configPath = join(project, 'stitch2.config.json')
writeFileSync(configPath, readFileSync(configPath, 'utf8').replace('../../config.schema.json', join(REPO, 'config.schema.json')))
const env = { ...process.env, STITCH2_CONFIG: configPath, FORCE_COLOR: '0', NO_COLOR: '1' }
const run = (args, cwd = project, e = env) => {
  const r = spawnSync('node', [CLI, ...args], { cwd, env: e, encoding: 'utf8' })
  return `${r.stdout}${r.stderr}`.trim()
}
const design = (p) => join(project, 'design', p)
const write = (p, s) => writeFileSync(design(p), s)

const v1 = readFileSync(design('screens/home/mobile-v1.html'), 'utf8')
const asReview = v1.replace('<meta name="gg-status" content="approved" />', '<meta name="gg-status" content="review" />')
// The agent's draft builds the tab bar by hand: other icons, sizes and raw colours.
const DRIFT = `<nav class="fixed inset-x-0 bottom-0 flex justify-around border-t border-hairline bg-iron px-2 pb-7 pt-2">
    <a class="flex flex-col items-center gap-1 text-[11px] font-medium text-[#E8662C]"><i data-lucide="house" class="size-5"></i>Home</a>
    <a class="flex flex-col items-center gap-1 text-[11px] text-steel"><i data-lucide="calendar-days" class="size-5"></i>Plan</a>
    <a class="-mt-5 flex flex-col items-center gap-1 text-[11px] text-steel"><i data-lucide="circle-play" class="size-11 text-[#E8662C]"></i>Start</a>
    <a class="flex flex-col items-center gap-1 text-[11px] text-steel"><i data-lucide="list" class="size-5"></i>Exercises</a>
    <a class="flex flex-col items-center gap-1 text-[11px] text-steel"><i data-lucide="chart-line" class="size-5"></i>Stats</a>
  </nav>`
const draft = asReview.replace('<gg-tab-bar active="home"></gg-tab-bar>', DRIFT)
if (draft === asReview) throw new Error('home/mobile-v1.html has no <gg-tab-bar active="home">')

// ---- terminal output ----
const terminal = {}
const fresh = mkdtempSync(join(film, 'my-app-'))
terminal.setup = { cmd: 'npx stitch2 setup --name "gymgym" --primary "#E8662C"', out: run(['setup', '--name', 'gymgym', '--primary', '#E8662C'], fresh, { ...env, STITCH2_CONFIG: '' }) }

console.log('checking the example (first run)…')
run(['check'])

// ---- the canvas ----
const canvas = spawn('node', [CLI, 'canvas'], { cwd: project, env: { ...env, PORT: String(PORT) }, stdio: 'ignore' })
process.on('exit', () => canvas.kill())
await sleep(1500)
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, colorScheme: 'dark' })
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: URL })
const page = await context.newPage()
const settle = async (extra = 2500) => {
  await page.waitForFunction(() => [...document.querySelectorAll('#world iframe')].every((f) => f.contentDocument?.readyState === 'complete'), null, { timeout: 60_000 })
  await sleep(extra)
}
await page.goto(URL)
await settle(4000)

// ---- recording ----
let rec = null
const mouse = { x: W * 0.62, y: H * 0.55 }
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2)
const now = () => Date.now() / 1000 - rec.start
async function move(x, y, ms = 700) {
  const steps = Math.max(1, Math.round(ms / 16))
  const from = { ...mouse }
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps)
    mouse.x = from.x + (x - from.x) * k
    mouse.y = from.y + (y - from.y) * k
    await page.mouse.move(mouse.x, mouse.y)
    rec?.cursor.push({ t: now(), x: mouse.x, y: mouse.y })
    await sleep(16)
  }
}
async function to(target, ms, dx = 0.5, dy = 0.5) {
  const b = await target.boundingBox()
  if (!b) throw new Error(`not visible: ${target}`)
  await move(b.x + b.width * dx, b.y + b.height * dy, ms)
}
async function click(target, ms, opts = {}) {
  if (target) await to(target, ms, opts.dx, opts.dy)
  rec?.cursor.push({ t: now(), x: mouse.x, y: mouse.y, click: true })
  await page.mouse.click(mouse.x, mouse.y, { modifiers: opts.modifiers })
}
const mark = (name) => { if (rec) rec.marks[name] = now() }
/** Smooth pan (plain wheel) or zoom around the cursor (Ctrl+wheel) on the canvas. */
async function wheel(dy, ms, zoom = false) {
  const steps = Math.max(1, Math.round(ms / 16))
  if (zoom) await page.keyboard.down('Control')
  let done = 0
  for (let i = 1; i <= steps; i++) {
    const next = Math.round(dy * ease(i / steps))
    await page.mouse.wheel(0, next - done)
    done = next
    await sleep(16)
  }
  if (zoom) await page.keyboard.up('Control')
}
const side = (text) => page.locator('#tree > *', { hasText: text }).first()
const frame = (path) => page.frameLocator(`iframe[src*="${path}"]`)

async function clip(name, actions) {
  if (only.length && !only.includes(name)) return actions(null)
  console.log(`recording ${name}…`)
  const cdp = await context.newCDPSession(page)
  const dir = mkdtempSync(join(film, `${name}-`))
  const frames = []
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = join(dir, `${String(frames.length).padStart(5, '0')}.jpg`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    frames.push({ file, t: metadata.timestamp })
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  rec = { start: Date.now() / 1000, cursor: [], marks: {} }
  rec.cursor.push({ t: 0, x: mouse.x, y: mouse.y })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: W * SCALE, maxHeight: H * SCALE })
  await actions(rec)
  await sleep(300)
  const end = Date.now() / 1000
  await cdp.send('Page.stopScreencast')
  await cdp.detach()
  // Screencast frames arrive only when the page changes: hold each one until the next.
  const lines = ['ffconcat version 1.0']
  frames.forEach((f, i) => {
    const from = i === 0 ? rec.start : f.t
    const until = frames[i + 1]?.t ?? end
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, until - from).toFixed(4)}`)
  })
  lines.push(`file '${frames.at(-1).file}'`)
  writeFileSync(join(dir, 'list.txt'), lines.join('\n'))
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
    '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-g', '15',
    join(OUT, `${name}.mp4`)])
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ duration: end - rec.start, scale: SCALE, cursor: rec.cursor, marks: rec.marks }))
  rec = null
}

// 1. The canvas: every screen, then one screen up close.
// Start wide (about 25%) on the first rows, then zoom into home.
await page.locator('#tree .screen-name', { hasText: 'home' }).first().click()
await page.keyboard.press('Escape')
for (let i = 0; i < 7; i++) { await page.keyboard.press('-'); await sleep(100) }
await settle(1500)
await clip('overview', async () => {
  await sleep(1000)
  await to(page.locator('iframe[src*="home/mobile-v1.html"]'), 1500, 0.5, 0.25)
  await wheel(-125, 2800, true)
  await sleep(1500)
})

// 2. An agent drafts home v2: it lands on the canvas, and the checks flag the hand-built tab bar.
await clip('draft', async (r) => {
  write('screens/home/mobile-v2.html', draft)
  await sleep(500)
  await settle(1500)
  if (r) mark('loaded')
  const out = run(['check', 'home/mobile-v2'])
  terminal.checkDraft = { cmd: 'npx stitch2 check home/mobile-v2', out }
  if (r) mark('checked')
  await sleep(1500)
  await click(side('v2 · mobile'), 900)
  await sleep(800)
  await to(page.locator('#inspector ul:not(.picks) li').nth(2), 900)
  await sleep(3000)
})

// 3. The consistency report: the tab bar from every screen next to the catalog's.
run(['consistency'])
await clip('consistency', async () => {
  await click(side('Consistency report'), 900)
  await sleep(2500)
  await move(W * 0.6, H * 0.5, 700)
  const row = page.frameLocator('#doc iframe').getByText('home · mobile · v2').first()
  const b = await row.boundingBox()
  await wheel(b.y - H * 0.42, 1800)
  await sleep(500)
  await move(W * 0.62, H * 0.5, 800)
  await sleep(2800)
  await page.keyboard.press('Escape')
})

// 4. Pick mode: point at the tab bar and copy a reference for the agent.
await clip('pick', async (r) => {
  await click(side('v2 · mobile'), 700)
  await sleep(900)
  await move(W * 0.55, H * 0.6, 600)
  const nav = await frame('home/mobile-v2.html').locator('nav').boundingBox()
  await wheel(nav.y + nav.height - H + 60, 1400)
  await sleep(400)
  await page.keyboard.press('p')
  await sleep(500)
  await to(frame('home/mobile-v2.html').locator('nav'), 1100, 0.3, 0.9)
  await sleep(900)
  await click(null)
  if (r) mark('copied')
  terminal.reference = await page.evaluate(() => navigator.clipboard.readText())
  await sleep(2500)
})
await page.locator('#inspector [data-a=clear]').click()
await page.keyboard.press('Escape')

// 5. The agent fixes it with the catalog's tab bar: the checks pass, and it is approved.
await clip('fix', async (r) => {
  write('screens/home/mobile-v2.html', asReview)
  await sleep(500)
  await settle(1500)
  terminal.checkFixed = { cmd: 'npx stitch2 check home/mobile-v2', out: run(['check', 'home/mobile-v2']) }
  if (r) mark('checked')
  await sleep(1200)
  await click(page.locator('#inspector .status button[data-st=approved]'), 1000)
  if (r) mark('approved')
  await sleep(2500)
})

// 6. DESIGN.md on the canvas: the tokens and rules every screen is built from.
await clip('designmd', async () => {
  await click(side('DESIGN.md'), 900)
  await sleep(2500)
  await move(W * 0.62, H * 0.6, 700)
  await wheel(420, 1600)
  await sleep(2500)
  await page.keyboard.press('Escape')
})

// 7. One colour in DESIGN.md: every screen follows.
await clip('tokens', async (r) => {
  await click(page.locator('#tree .screen-name', { hasText: 'workout' }).first(), 800)
  await sleep(600)
  await page.keyboard.press('Escape')
  for (let i = 0; i < 3; i++) { await page.keyboard.press('-'); await sleep(150) }
  await sleep(1500)
  const md = readFileSync(design('DESIGN.md'), 'utf8')
  write('DESIGN.md', md.replace('ember: "#E8662C"', 'ember: "#2F6FEB"').replace('ember-pressed: "#D2591F"', 'ember-pressed: "#2559C9"').replace('ember-wash: "rgba(232, 102, 44, 0.14)"', 'ember-wash: "rgba(47, 111, 235, 0.14)"'))
  terminal.tokens = { cmd: 'npx stitch2 tokens', out: run(['tokens']) }
  if (r) mark('tokens')
  await sleep(1000)
  await settle(3500)
})

writeFileSync(join(OUT, '../terminal.json'), JSON.stringify(terminal, null, 2))
await browser.close()
canvas.kill()
console.log(`clips in ${OUT}; film set ${film}`)
