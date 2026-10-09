/**
 * The live app against the approved screens. For every approved version whose screen has a route in the config's
 * "app" section, it opens the approved version and the app page at the same width and compares their structure:
 * which shared components appear (by their data-<prefix> marker), how many, in what order, and how the measured
 * ones look. Data differs between a mock-up and the app, so pixels are shown side by side, not diffed.
 * Writes <design>/compare/index.html (the canvas opens it from its sidebar) and <design>/compare.json.
 *
 *   "app": {
 *     "url": "http://localhost:4321",
 *     "signIn": "design/app/sign-in.mjs",          // export default async ({ page, url }) => { … }
 *     "routes": {
 *       "home": "/app",
 *       "exercise-detail": { "path": "/app/library", "prepare": "design/app/open-exercise.mjs" },
 *       "sign-in": { "path": "/login", "signedOut": true }   // a page of its own, never signed in
 *     }
 *   }
 *
 * Usage: stitch2 compare [screen…] [--strict]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, type Page } from '@playwright/test'
import { BASE, config } from './config.ts'
import { type Components, collectComponents, collectOptions } from './consistency.ts'
import { listScreens, ROOT } from './screens.ts'
import { startServer } from './serve.ts'

type Route = string | { path: string; prepare?: string; signedOut?: boolean }
const app = config.app
if (!app?.url || !app.routes) {
  console.error('stitch2 compare: add an "app" section with "url" and "routes" to stitch2.config.json')
  process.exit(1)
}
const args = process.argv.slice(2)
const only = args.filter((a) => !a.startsWith('--'))
const strict = args.includes('--strict')
const routeOf = (screen: string): { path: string; prepare?: string; signedOut?: boolean } | undefined => {
  const r = app.routes[screen] as Route | undefined
  return typeof r === 'string' ? { path: r } : r
}
const versions = listScreens().filter(
  (s) => s.kind === 'screen' && s.status === 'approved' && routeOf(s.screen) && (!only.length || only.includes(s.screen)),
)
const unmapped = [...new Set(listScreens().filter((s) => s.status === 'approved' && !routeOf(s.screen)).map((s) => s.screen))]

/** Runs in the page: every marked component in document order, and the top-level ones (not inside another). */
function structure(prefix: string) {
  const marker = `data-${prefix}`
  const shown = (el: Element) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'contents') return [...el.children].some(shown)
    const r = el.getBoundingClientRect()
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0
  }
  const all = [...document.querySelectorAll(`[${marker}]`)].filter(shown)
  const counts: Record<string, number> = {}
  for (const el of all) {
    const k = el.getAttribute(marker)!
    counts[k] = (counts[k] ?? 0) + 1
  }
  const top = all.filter((el) => !el.parentElement?.closest(`[${marker}]`)).map((el) => el.getAttribute(marker)!)
  return { counts, top }
}

/** Longest common subsequence length, for how much of the design's order the app keeps. */
function lcs(a: string[], b: string[]): number {
  const d = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = a[i - 1] === b[j - 1] ? d[i - 1]![j - 1]! + 1 : Math.max(d[i - 1]![j]!, d[i]![j - 1]!)
  return d[a.length]![b.length]!
}

interface Finding {
  severity: 'error' | 'warning'
  type: string
  message: string
}
interface Result {
  screen: string
  device: string
  version: string
  design: string
  url: string
  findings: Finding[]
  match: number
}

const load = async (file: string) => (await import(pathToFileURL(resolve(BASE, file)).href)).default as (o: { page: Page; url: string }) => Promise<void>
const settle = async (page: Page) => {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(800)
}

const out = join(ROOT, 'compare')
mkdirSync(out, { recursive: true })
const server = await startServer(0)
const browser = await chromium.launch()
const context = await browser.newContext({ deviceScaleFactor: 2 })
const signIn = await context.newPage()
if (app.signIn) await (await load(app.signIn))({ page: signIn, url: app.url })
await signIn.close()
const design = await browser.newPage({ deviceScaleFactor: 2 })
const signedIn = await context.newPage()
// Sign-in and other public pages often redirect a signed-in visitor, so they get a context of their own.
const signedOut = await (await browser.newContext({ deviceScaleFactor: 2 })).newPage()
const results: Result[] = []
const opts = collectOptions()
for (const s of versions) {
  const route = routeOf(s.screen)!
  const live = route.signedOut ? signedOut : signedIn
  const url = new URL(route.path, app.url).href
  const height = s.width > 700 ? 800 : 844
  for (const p of [design, live]) await p.setViewportSize({ width: s.width, height })
  await design.goto(`http://127.0.0.1:${server.port}/${s.path}`).catch(() => {})
  await settle(design)
  await live.goto(url).catch(() => {})
  await settle(live)
  const findings: Finding[] = []
  if (route.prepare) {
    // A failing prepare is this version's error; the run goes on with the others.
    try {
      await (await load(route.prepare))({ page: live, url: app.url })
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).split('\n')[0]
      findings.push({ severity: 'error', type: 'prepare', message: `${route.prepare} failed: ${message}` })
    }
    await settle(live)
  }
  const [d, a] = [await design.evaluate(structure, config.prefix), await live.evaluate(structure, config.prefix)]
  const [dc, ac]: Components[] = [
    (await design.evaluate(collectComponents, opts)).components,
    (await live.evaluate(collectComponents, opts)).components,
  ]
  const missing = Object.keys(d.counts).filter((k) => !a.counts[k])
  const extra = Object.keys(a.counts).filter((k) => !d.counts[k])
  if (missing.length) findings.push({ severity: 'error', type: 'missing', message: `In the design, not in the app: ${missing.join(', ')}` })
  if (extra.length) findings.push({ severity: 'warning', type: 'extra', message: `In the app, not in the design: ${extra.join(', ')}` })
  const kept = lcs(d.top, a.top)
  if (d.top.length && kept < d.top.length)
    findings.push({
      severity: 'warning',
      type: 'order',
      message: `Layout differs: ${kept} of ${d.top.length} top-level components in the design's order (design: ${d.top.join(' → ')}; app: ${a.top.join(' → ') || 'none'})`,
    })
  for (const [kind, sigs] of Object.entries(dc)) {
    const mine = ac[kind]?.[0]
    const ref = sigs[0]
    if (!mine || !ref || !Object.keys(ref.fields).length) continue
    const diffs = Object.keys({ ...ref.fields, ...mine.fields }).filter((f) => ref.fields[f] !== mine.fields[f])
    if (diffs.length)
      findings.push({
        severity: 'warning',
        type: 'look',
        message: `${kind} looks different: ${diffs.map((f) => `${f} ${mine.fields[f] ?? '–'} (design ${ref.fields[f] ?? '–'})`).join('; ')}`,
      })
  }
  const kinds = Object.keys(d.counts)
  const match = kinds.length ? Math.round((100 * kinds.filter((k) => a.counts[k]).length) / kinds.length) : 100
  const base = `${s.screen}-${s.device}`
  await design.screenshot({ path: join(out, `${base}-design.png`), fullPage: true })
  await live.screenshot({ path: join(out, `${base}-app.png`), fullPage: true })
  results.push({ screen: s.screen, device: s.device, version: s.version, design: s.path, url, findings, match })
  const errors = findings.filter((f) => f.severity === 'error').length
  console.log(`${errors ? '✗' : '✓'} ${base.padEnd(30)} ${String(match).padStart(3)}% of the design's components · ${errors} errors, ${findings.length - errors} warnings`)
  for (const f of findings.filter((f) => f.severity === 'error')) console.log(`    ${f.type}: ${f.message}`)
}
await browser.close()
server.close()

const esc = (v: unknown) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const rows = results
  .map((r) => {
    const base = `${r.screen}-${r.device}`
    const list = r.findings.length
      ? r.findings.map((f) => `<li class="${f.severity}"><b>${f.type}</b> ${esc(f.message)}</li>`).join('')
      : '<li class="ok">Matches the design’s structure.</li>'
    return `<section><h2>${esc(r.screen)} · ${r.device} · ${r.version} <span>${r.match}%</span></h2><p><code>${esc(r.design)}</code> ↔ <a href="${esc(r.url)}">${esc(r.url)}</a></p><ul>${list}</ul><div class="imgs"><figure><figcaption>Approved design</figcaption><img src="${base}-design.png" alt=""></figure><figure><figcaption>App</figcaption><img src="${base}-app.png" alt=""></figure></div></section>`
  })
  .join('')
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>App comparison</title><style>body{background:#0b0b0d;color:#f4f4f5;font:14px/1.5 system-ui,sans-serif;margin:0}main{margin:0 auto;max-width:1400px;padding:32px}h1{font-size:22px}h2{font-size:17px;margin:32px 0 4px}h2 span{color:#a1a1aa;font-weight:400;margin-left:8px}code,a{color:#a1a1aa}ul{margin:8px 0;padding-left:18px}li.error b{color:#e5484d}li.warning b{color:#e5b54a}li.ok{color:#3fb27f}.imgs{display:flex;gap:16px;align-items:flex-start}figure{margin:0}figcaption{color:#a1a1aa;font-size:12px;margin-bottom:4px}img{border:1px solid #2e2e33;border-radius:8px;max-width:640px;width:100%}</style></head><body><main><h1>App comparison</h1><p>${new Date().toISOString()} · ${results.length} approved versions against ${esc(app.url)}${unmapped.length ? ` · no route for: ${esc(unmapped.join(', '))}` : ''}</p>${rows}</main></body></html>\n`,
)
writeFileSync(join(ROOT, 'compare.json'), `${JSON.stringify({ comparedAt: new Date().toISOString(), url: app.url, results, unmapped }, null, 2)}\n`)
const total = results.reduce((n, r) => n + r.findings.filter((f) => f.severity === 'error').length, 0)
console.log(`\n${results.length} versions compared, ${total} errors${unmapped.length ? `; no route for ${unmapped.join(', ')}` : ''}. Report: ${config.designDir}/compare/index.html`)
if (strict && total) process.exit(1)
