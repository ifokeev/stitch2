/**
 * Pictures of screens for the canvas. A live screen is a whole page (Tailwind's browser build, fonts, icons, the
 * components), so a canvas with a hundred of them stalls the browser; the canvas keeps only the screens in view live
 * and draws the rest from these. One headless Chromium renders them, three at a time, and they are kept on disk
 * (os.tmpdir()/stitch2-shots), keyed by everything that changes the picture: the screen file, the files screens
 * share (tokens, components, stylesheets), the theme, the modes, the language and its messages, and the width.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Browser } from '@playwright/test'
import { messagesFile, sourceLocale } from './i18n.ts'
import { ROOT, meta, tag } from './screens.ts'

/** The tallest picture, in CSS px: the same limit as the canvas frames and check's renders. */
const MAX_HEIGHT = 20000
const DIR = join(tmpdir(), 'stitch2-shots')
/** Folders under the design directory that hold outputs, not inputs: they never change a picture. */
const OUTPUTS = new Set(['renders', 'consistency', 'compare', 'states', 'node_modules', '.git'])
const REPORTS = new Set(['checks.json', 'compare.json', 'type-audit.json'])

export interface ShotRequest {
  path: string
  width: number
  theme?: string
  lang?: string
  /** Attributes set on the page's <html> before the picture: the app states picked in the canvas (config modes). */
  modes?: Record<string, string>
}

let shared: number | undefined
/** The newest of the files screens share: anything under the design directory that isn't a screen or an output. */
function sharedStamp(): number {
  if (shared !== undefined) return shared
  let newest = 0
  const walk = (dir: string, depth: number) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (depth === 0 && OUTPUTS.has(e.name)) continue
        if (depth < 4) walk(join(dir, e.name), depth + 1)
      } else if (!e.name.endsWith('.html') && !(depth === 0 && REPORTS.has(e.name)))
        newest = Math.max(newest, statSync(join(dir, e.name)).mtimeMs)
    }
  }
  walk(ROOT, 0)
  return (shared = newest)
}
/** The server's file watcher calls this: the next picture looks at the shared files again. */
export function sharedChanged() {
  shared = undefined
}

function keyOf(r: ShotRequest): string | null {
  const file = join(ROOT, r.path)
  if (!existsSync(file)) return null
  const messages = r.lang && r.lang !== sourceLocale() ? messagesFile(r.lang) : undefined
  const parts = [
    'viewport-v2',
    r.path,
    statSync(file).mtimeMs,
    sharedStamp(),
    r.theme ?? '',
    JSON.stringify(Object.entries(r.modes ?? {}).sort(([a], [b]) => a.localeCompare(b))),
    r.lang ?? '',
    messages && existsSync(messages) ? statSync(messages).mtimeMs : '',
    r.width,
  ]
  return createHash('sha1').update(parts.join('|')).digest('hex')
}

let browser: Promise<Browser> | undefined
let busy = 0
const waiting: (() => void)[] = []
const pending = new Map<string, Promise<Buffer>>()

async function slot<T>(work: () => Promise<T>): Promise<T> {
  while (busy >= 3) await new Promise<void>((go) => waiting.push(go))
  busy++
  try {
    return await work()
  } finally {
    busy--
    waiting.shift()?.()
  }
}

/** A JPEG of the screen as the canvas would show it, page-tall up to MAX_HEIGHT; null when the file is gone. */
export function shot(base: string, r: ShotRequest): Promise<Buffer> | null {
  const key = keyOf(r)
  if (!key) return null
  const file = join(DIR, `${key}.jpg`)
  if (existsSync(file)) return Promise.resolve(readFileSync(file))
  const inFlight = pending.get(key)
  if (inFlight) return inFlight
  const job = slot(async () => {
    browser ??= launch()
    const page = await (await browser).newPage({ viewport: { width: r.width, height: 844 }, deviceScaleFactor: 1 })
    try {
      const viewport = Math.min(4000, Math.max(200, Number(meta(readFileSync(join(ROOT, r.path), 'utf8'), tag('frame-height'))) || 844))
      await page.setViewportSize({ width: r.width, height: viewport })
      const query = new URLSearchParams({ canvas: String(viewport) })
      if (r.lang && r.lang !== sourceLocale()) query.set('lang', r.lang)
      await page.goto(`${base}/${r.path}?${query}`, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {})
      if (r.theme) await page.evaluate((t) => { document.documentElement.dataset.theme = t }, r.theme)
      const attributes = Object.entries(r.modes ?? {})
      if (attributes.length) await page.evaluate((list) => { for (const [name, value] of list) document.documentElement.setAttribute(name, value) }, attributes)
      await page.evaluate(() => document.fonts.ready)
      // Tailwind's browser build and the components settle after load.
      await page.waitForTimeout(400)
      const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0))
      await page.setViewportSize({ width: r.width, height: Math.min(MAX_HEIGHT, Math.max(844, height)) })
      const jpg = await page.screenshot({ type: 'jpeg', quality: 80 })
      mkdirSync(DIR, { recursive: true })
      writeFileSync(file, jpg)
      return jpg
    } finally {
      await page.close()
    }
  })
  pending.set(key, job)
  const done = () => pending.delete(key)
  job.then(done, done)
  return job
}

export async function closeShots() {
  const b = await browser?.catch(() => undefined)
  browser = undefined
  await b?.close()
}

/**
 * Playwright's own signal handlers close the browser but leave the process running; the canvas would outlive
 * Ctrl-C. Here a signal closes Chromium, then exits.
 */
async function launch(): Promise<Browser> {
  const { chromium } = await import('@playwright/test')
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
    process.once(signal, () => {
      void closeShots().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143))
    })
  return chromium.launch({ handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
}
