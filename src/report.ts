/**
 * Consistency report: every shared component cropped from every active screen, next to the component
 * catalog's version, with what differs. Writes <design>/consistency/index.html, which the canvas opens from
 * its sidebar. Usage: stitch2 consistency [kind…]   (kinds: tab-bar, header, icon-button, chip, …)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { config } from './config.ts'
import {
  type Components,
  collectComponents,
  collectOptions,
  consistencyIssues,
  nameOf,
} from './consistency.ts'
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

const server = await startServer(0)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const known: Record<string, Components> = {}
const crops: Record<string, Record<string, string[]>> = {} // kind -> path -> image files
for (const s of screens) {
  await page.setViewportSize({ width: s.width, height: 844 })
  await page
    .goto(`http://127.0.0.1:${server.port}/${s.path}`, { waitUntil: 'networkidle', timeout: 30_000 })
    .catch(() => {})
  await page.waitForTimeout(600)
  const found = await page.evaluate(collectComponents, collectOptions())
  known[s.path] = found.components
  for (const [kind, sigs] of Object.entries(found.components)) {
    if (kinds.length && !kinds.includes(kind.split(':')[0]!)) continue
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
}
await browser.close()
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
        return `<div class="row"><div class="who"><b>${esc(s.kind === 'components' ? 'Component catalog' : `${s.screen} · ${s.device} · ${s.version}`)}</b><code>${esc(path)}</code>${verdict}</div><div class="imgs">${files.map((f) => `<img src="${esc(f)}" alt="" />`).join('')}</div></div>`
      })
      .join('')
    return `<section><h2>${esc(nameOf(kind))} <span>${esc(kind)}</span></h2>${rows}</section>`
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
</style></head><body><main><h1>Consistency report</h1><code>${new Date().toISOString()} · ${screens.length} active screens · reference: ${esc(config.catalogDir)}</code>${sections}</main></body></html>\n`,
)
console.log(
  `consistency report: ${join(out, 'index.html')} (${Object.keys(crops).length} components, ${screens.length} screens)`,
)
