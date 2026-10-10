/**
 * Layout checks for every screen, the bugs we kept hitting in generated designs: content past the screen
 * edge, labels wrapping onto two lines, content hidden under fixed bars, tiny tap targets, low text
 * contrast, and text styles that are not one of DESIGN.md's type levels. Writes design/checks.json, which
 * the canvas shows as badges.
 * Every screen is checked in its own theme, then again in each other theme DESIGN.md defines (designThemes):
 * colours change there, so contrast is checked again, tagged with the theme.
 * Then again in each check language (i18n.ts: the pseudo-languages and the config's): layout problems that
 * show only there (a label running into its neighbour, text cut off, a control drawn backwards right to left),
 * and keys a locale has no translation for, tagged with the locale.
 * Usage: stitch2 check [path filter…] [--shots] [--strict] [--locales ru,ar | all | none]
 *   --shots   also save page-tall renders to design/renders/ (one per theme)
 *   --strict  exit 1 when any screen has errors (for CI and agent loops)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { colourIssues } from './colours.ts'
import { config } from './config.ts'
import {
  type Components,
  collectComponents,
  collectOptions,
  consistencyIssues,
  reuseIssues,
} from './consistency.ts'
import { designThemes, typeLevels } from './design-md.ts'
import { checkLocales } from './i18n.ts'
import { listScreens, ROOT } from './screens.ts'
import { startServer } from './serve.ts'
import { collectText, type Issue, typeIssues } from './typecheck.ts'
import { audit } from './audit.ts'


const args = process.argv.slice(2)
const shots = args.includes('--shots')
const strict = args.includes('--strict')
const localesFlag = args.indexOf('--locales')
const locales = checkLocales(localesFlag >= 0 ? args[localesFlag + 1] : undefined)
const filters = args.filter((a, i) => !a.startsWith('--') && (localesFlag < 0 || i !== localesFlag + 1))
const screens = listScreens().filter((s) => !filters.length || filters.some((f) => s.path.includes(f)))

const levels = typeLevels()
const themes = designThemes()
const collect = collectOptions()
const server = await startServer(0)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const results: Record<string, Issue[]> = {}
const components: Record<string, Components> = {}
for (const s of screens) {
  await page.setViewportSize({ width: s.width, height: 844 })
  await page
    .goto(`http://127.0.0.1:${server.port}/${s.path}`, { waitUntil: 'networkidle', timeout: 30_000 })
    .catch(() => {})
  // Tailwind's CDN build, web fonts and the lab components settle after load.
  await page.waitForTimeout(600)
  const found = await page.evaluate(collectComponents, collect)
  components[s.path] = found.components
  const own = await page.evaluate(() => document.documentElement.dataset.theme || '')
  const base = own || themes[0]!
  const layout = await page.evaluate(audit, { comfortable: config.comfortableTarget })
  for (const i of layout) if (i.type === 'contrast') i.theme = base
  // The other themes: what the colours change (contrast), plus anything that only shows there.
  const seen = new Set(layout.map((i) => `${i.type} ${i.selector}`))
  const themed: Issue[] = []
  for (const theme of themes.filter((t) => t !== base)) {
    await setTheme(theme)
    for (const i of await page.evaluate(audit, { comfortable: config.comfortableTarget }))
      if (i.type === 'contrast' || !seen.has(`${i.type} ${i.selector}`))
        themed.push({ ...i, theme, message: `${theme} theme: ${i.message}` })
    if (shots) await shoot(s, theme)
  }
  if (themes.length > 1) await setTheme(base)
  const typed = typeIssues(levels, await page.evaluate(collectText))
  if (shots) await shoot(s)
  // The other languages, in the screen's own theme. Reported once per element and kind, in the first locale.
  const unknownSeen = new Set<string>()
  for (const locale of locales) {
    await page
      .goto(`http://127.0.0.1:${server.port}/${s.path}?lang=${encodeURIComponent(locale)}`, { waitUntil: 'networkidle', timeout: 30_000 })
      .catch(() => {})
    await page.waitForTimeout(600)
    for (const i of await page.evaluate(audit, { comfortable: config.comfortableTarget })) {
      const key = `${i.type} ${i.selector}`
      if (i.type === 'contrast' || seen.has(key)) continue
      seen.add(key)
      themed.push({ ...i, locale, message: `${locale}: ${i.message}` })
    }
    const lost = await page.evaluate(
      () =>
        (
          window as unknown as {
            __stitch2?: { missing: { keys: string; all: string; text: string; unknown: string }[] }
          }
        ).__stitch2?.missing ?? [],
    )
    for (const m of lost) {
      const selector = `[data-s2-key="${m.all}"]`
      const unknown = m.unknown.split(' ').filter(Boolean)
      const fresh = unknown.filter((k) => !unknownSeen.has(k))
      fresh.forEach((k) => unknownSeen.add(k))
      if (fresh.length)
        themed.push({
          severity: 'error',
          type: 'i18n-unknown-key',
          selector,
          text: m.text,
          message: `No message for ${fresh.join(' ')}: add it to the source language's messages`,
        })
      const lacks = m.keys.split(' ').filter((k) => !unknown.includes(k))
      if (lacks.length)
        themed.push({
          severity: 'warning',
          type: 'i18n-missing',
          locale,
          selector,
          text: m.text,
          message: `${locale}: no translation for ${lacks.join(' ')}`,
        })
    }
    if (shots) await shoot(s, undefined, locale)
  }
  results[s.path] = [
    ...layout,
    ...themed,
    ...typed,
    ...reuseIssues(s.path, found),
    ...colourIssues(s.path),
  ]
}
await browser.close()
server.close()

async function setTheme(theme: string) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t
  }, theme)
  await page.waitForTimeout(150)
}

/** A page-tall render; renders in another theme or language than the screen's own get a --<theme> suffix. */
async function shoot(s: { path: string; width: number }, theme?: string, locale?: string) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.setViewportSize({ width: s.width, height: Math.max(844, Math.min(height, 6000)) })
  mkdirSync(join(ROOT, 'renders'), { recursive: true })
  const suffix = theme ?? locale
  const name = s.path.replaceAll('/', '__').replace(/\.html$/, suffix ? `--${suffix}.png` : '.png')
  await page.screenshot({ path: join(ROOT, 'renders', name) })
  await page.setViewportSize({ width: s.width, height: 844 })
}

// Merge with the last results, so a filtered run still compares components with every other screen.
let previous: { screens?: Record<string, Issue[]>; components?: Record<string, Components> } = {}
try {
  previous = JSON.parse(readFileSync(join(ROOT, 'checks.json'), 'utf8'))
} catch {}
const exists = new Set(listScreens().map((s) => s.path))
const keep = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([p]) => exists.has(p)))
const allComponents = keep({ ...previous.components, ...components })
// Archived versions are history: they do not vote on how a component should look.
const archived = new Set(
  listScreens()
    .filter((s) => s.status === 'archived')
    .map((s) => s.path),
)
const consistency = consistencyIssues(
  Object.fromEntries(Object.entries(allComponents).filter(([p]) => !archived.has(p) || p in results)),
  Object.keys(results),
)
let errors = 0
for (const s of screens) {
  const issues = [...results[s.path]!, ...(consistency[s.path] ?? [])].sort((x, y) =>
    x.severity === y.severity ? 0 : x.severity === 'error' ? -1 : 1,
  )
  results[s.path] = issues
  const e = issues.filter((i) => i.severity === 'error').length
  errors += e
  console.log(`${e ? '✗' : '✓'} ${s.path.padEnd(42)} ${e} errors, ${issues.length - e} warnings`)
  for (const i of issues.filter((i) => i.severity === 'error'))
    console.log(`    ${i.type}: ${i.message}${i.text ? ` — “${i.text}”` : ''}`)
}
writeFileSync(
  join(ROOT, 'checks.json'),
  `${JSON.stringify({ checkedAt: new Date().toISOString(), screens: keep({ ...previous.screens, ...results }), components: allComponents }, null, 2)}\n`,
)
console.log(
  `\n${screens.length} screens checked, ${errors} errors. Results in design/checks.json (badges on the canvas).`,
)
if (strict && errors) process.exit(1)
