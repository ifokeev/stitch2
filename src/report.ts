/**
 * Consistency report: every shared component cropped from every active screen, next to the component
 * catalog's version, with what differs. Writes <design>/consistency/index.html, which the canvas opens from
 * its sidebar. Usage: stitch2 consistency [kind…]   (kinds: tab-bar, header, icon-button, chip, …)
 * Signatures and crops are cached in <design>/consistency/known.json: reruns only visit screens that are
 * new, changed, or lack crops for the requested kinds, and check the issues against every screen.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { fingerprintPaths } from './cache.ts'
import { CONFIG_FILE, config } from './config.ts'
import {
  type Components,
  collectComponents,
  collectOptions,
  consistencyIssues,
  nameOf,
} from './consistency.ts'
import { filterSnippet } from './report-filter.ts'
import { listScreens, ROOT } from './screens.ts'
import { startServer } from './serve.ts'

const kinds = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const screens = listScreens().filter((s) => s.status !== 'archived')
const out = join(ROOT, 'consistency')
mkdirSync(out, { recursive: true })
const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '_')
const esc = (s: unknown) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

interface CachedScreen {
  mtime: number
  deps?: string
  sourceKey?: string
  components: Components
  /** Component kinds cropped for this screen ('all' after an unfiltered run). */
  kinds: string[]
  /** Crop files by kind, reused while the screen is unchanged. */
  crops: Record<string, string[]>
}

const KNOWN_FILE = join(out, 'known.json')
const cached: Record<string, CachedScreen> = existsSync(KNOWN_FILE)
  ? (JSON.parse(readFileSync(KNOWN_FILE, 'utf8')) as Record<string, CachedScreen>)
  : {}
const deps = fingerprintPaths([
  ...['DESIGN.md', 'tokens.css', 'tokens.json', 'components', config.catalogDir].map((p) => join(ROOT, p)),
  ...(CONFIG_FILE ? [CONFIG_FILE] : []),
  fileURLToPath(new URL('.', import.meta.url)),
])
const sourceKeys = Object.fromEntries(screens.map((s) => [s.path, fingerprintPaths([join(ROOT, s.path)])]))
// A screen needs a visit when it is new, changed, or lacks crops for the requested kinds.
const needsVisit = (path: string): boolean => {
  const hit = cached[path]
  if (!hit || hit.deps !== deps || hit.sourceKey !== sourceKeys[path]) return true
  if (!kinds.length) return !hit.kinds.includes('all')
  return !kinds.every((k) => hit.kinds.includes(k) || hit.kinds.includes('all'))
}
const todo = screens.filter((s) => needsVisit(s.path))
const todoPaths = new Set(todo.map((s) => s.path))
const server = await startServer(0)
const CONCURRENCY = 4
const known: Record<string, Components> = {}
const crops: Record<string, Record<string, string[]>> = {} // kind -> path -> image files
// Reuse the cached signatures and crops of unchanged screens; only changed screens get a visit.
for (const s of screens) {
  const hit = cached[s.path]
  if (hit && !todoPaths.has(s.path)) {
    known[s.path] = hit.components
    for (const [kind, files] of Object.entries(hit.crops)) {
      if (kinds.length && !kinds.includes(kind.split(':')[0]!)) continue
      crops[kind] ??= {}
      crops[kind]![s.path] = files
    }
  }
}
const fresh = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  return { browser, page, visits: 0 }
}
const pool = await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, fresh))
/** Component families cropped per visited screen, merged into the cache. */
const visitedKinds: Record<string, Set<string>> = {}
let cursor = 0
// One screen per worker at a time: workers pull from the queue, so a page is never shared.
const runOne = async (
  s: (typeof screens)[number],
  worker: Awaited<ReturnType<typeof fresh>>,
): Promise<void> => {
  try {
    if (worker.visits > 0 && worker.visits % 50 === 0) {
      // Chromium gets fragile after hundreds of page loads; a fresh browser keeps long runs alive.
      await worker.page.close().catch(() => {})
      await worker.browser.close().catch(() => {})
      const next = await fresh()
      worker.browser = next.browser
      worker.page = next.page
    }
    worker.visits++
    const page = worker.page
    await page.setViewportSize({ width: s.width, height: 844 })
    await page
      .goto(`http://127.0.0.1:${server.port}/${s.path}`, { waitUntil: 'networkidle', timeout: 30_000 })
      .catch(() => {})
    await page.waitForTimeout(600)
    const found = await page.evaluate(collectComponents, collectOptions())
    known[s.path] = found.components
  visitedKinds[s.path] = new Set<string>()
  for (const [kind, sigs] of Object.entries(found.components)) {
    if (kinds.length && !kinds.includes(kind.split(':')[0]!)) continue
    visitedKinds[s.path]!.add(kind.split(':')[0]!)
    const files: string[] = []
    for (const [i, sig] of sigs.entries()) {
      const file = `${safe(kind)}/${safe(s.path)}-${i}.png`
      mkdirSync(join(out, safe(kind)), { recursive: true })
      try {
        // Crop the element plus anything drawn outside it (a raised centre button above a tab bar).
        const el = page.locator(sig.selector).first()
        await el.scrollIntoViewIfNeeded({ timeout: 3000 })
        const clip = await el.evaluate((node) => {
          const r = node.getBoundingClientRect()
          let top = r.top
          let bottom = r.bottom
          for (const c of node.querySelectorAll('*')) {
            const q = c.getBoundingClientRect()
            if (q.width && q.height) {
              top = Math.min(top, q.top)
              bottom = Math.max(bottom, q.bottom)
            }
          }
          return {
            x: Math.max(0, r.left),
            y: Math.max(0, top),
            width: r.width,
            height: bottom - Math.max(0, top),
          }
        })
        if (clip.width < 1 || clip.height < 1) continue
        await page.screenshot({ path: join(out, file), clip })
        files.push(file)
      } catch {}
    }
    crops[kind] ??= {}
    crops[kind]![s.path] = files
  }
  if (!kinds.length) visitedKinds[s.path]!.add('all')
  } catch (e) {
    // A dead page must not kill the other workers: the screen keeps no cache entry and is retried next run.
    delete known[s.path]
    delete visitedKinds[s.path]
    console.error(`consistency: skipping ${s.path} (${String(e).split('\n')[0]})`)
  }
}
const drive = async (worker: Awaited<ReturnType<typeof fresh>>): Promise<void> => {
  while (cursor < todo.length) await runOne(todo[cursor++]!, worker)
}
await Promise.all(pool.map((w) => drive(w)))
// Remember what this run saw: visited screens with fresh mtimes, the rest untouched. Screens that are
// gone leave the cache; their rows leave the report with them.
const live = new Set(screens.map((s) => s.path))
const next: Record<string, CachedScreen> = {}
for (const [path, hit] of Object.entries(cached)) {
  if (live.has(path) && !todoPaths.has(path)) next[path] = hit
}
for (const s of todo) {
  // Screens that failed keep no cache entry, so the next run retries them.
  if (!known[s.path]) continue
  const screenCrops: Record<string, string[]> = {}
  for (const [kind, byPath] of Object.entries(crops)) {
    if (byPath[s.path]) screenCrops[kind] = byPath[s.path]
  }
  const prev = cached[s.path]?.deps === deps && cached[s.path]?.sourceKey === sourceKeys[s.path] ? cached[s.path] : undefined
  const families = new Set([...(prev?.kinds ?? []), ...(visitedKinds[s.path] ?? [])])
  if (!kinds.length) families.add('all')
  else for (const k of kinds) families.add(k)
  try {
    next[s.path] = {
      mtime: statSync(join(ROOT, s.path)).mtimeMs,
      deps,
      sourceKey: sourceKeys[s.path],
      components: known[s.path]!,
      kinds: [...families],
      crops: { ...(prev?.crops ?? {}), ...screenCrops },
    }
  } catch {}
}
writeFileSync(KNOWN_FILE, JSON.stringify(next))
await Promise.all(pool.map(async (w) => {
  await w.page.close().catch(() => {})
  await w.browser.close().catch(() => {})
}))
server.close()

const issues = consistencyIssues(known, Object.keys(known))
const ORDER = ['tab-bar', 'header', 'icon-button', 'button:primary:md', 'chip', 'section']
const rank = (k: string) => (ORDER.includes(k) ? ORDER.indexOf(k) : ORDER.length)
const byPath = new Map(screens.map((s) => [s.path, s]))
const sections = Object.keys(crops)
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  .map((kind) => {
    const rows = Object.entries(crops[kind]!)
      .sort(([a], [b]) =>
        a.startsWith(config.catalogDir) ? -1 : b.startsWith(config.catalogDir) ? 1 : a.localeCompare(b),
      )
      .map(([path, files]) => {
        const s = byPath.get(path)!
        const note = (issues[path] ?? []).filter(
          (i) => i.message.startsWith(nameOf(kind)) || i.message.includes(nameOf(kind).toLowerCase()),
        )
        const verdict = path.startsWith(config.catalogDir)
          ? '<b class="ref">catalog: the reference</b>'
          : note.length
            ? note.map((i) => `<p class="bad">${esc(i.message)}</p>`).join('')
            : '<b class="ok">matches</b>'
        const ref = path.startsWith(config.catalogDir) ? ' data-ref' : ''
        return `<div class="row" data-path="${esc(path)}"${ref}><div class="who"><b>${esc(s.kind === 'components' ? 'Component catalog' : `${s.screen} · ${s.device} · ${s.version}`)}</b><code>${esc(path)}</code>${verdict}</div><div class="imgs">${files.map((f) => `<img src="${esc(f)}" alt="" />`).join('')}</div></div>`
      })
      .join('')
    return `<section data-group><h2>${esc(nameOf(kind))} <span>${esc(kind)}</span></h2>${rows}</section>`
  })
  .join('')
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Consistency report</title><style>
  body { background: #0f0f11; color: #f4f4f5; font: 14px/1.5 system-ui, sans-serif; margin: 0; }
  main { margin: 0 auto; max-width: 1200px; padding: 32px; }
  h1 { font-size: 26px; margin: 0 0 4px; } h2 { font-size: 18px; margin: 40px 0 12px; } h2 span, code { color: #71717a; font: 12px ui-monospace, monospace; }
  .row { border-top: 1px solid #2e2e33; display: grid; gap: 20px; grid-template-columns: 320px 1fr; padding: 14px 0; }
  .who { display: grid; gap: 4px; align-content: start; min-width: 0; overflow-wrap: anywhere; } .imgs { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; min-width: 0; }
  img { background: #000; border: 1px solid #2e2e33; border-radius: 8px; max-width: 100%; width: 390px; }
  .ok { color: #3fb27f; } .ref { color: #a1a1aa; } .bad { color: #e5b54a; margin: 0; font-size: 13px; }
</style></head><body><main><h1>Consistency report</h1><code>${new Date().toISOString()} · ${screens.length} active screens · reference: ${esc(config.catalogDir)}</code><p id="stitch2-filter" hidden></p>${sections}</main>${filterSnippet}</body></html>\n`,
)
console.log(
  `consistency report: ${join(out, 'index.html')} (${Object.keys(crops).length} components, ${screens.length} screens)`,
)
