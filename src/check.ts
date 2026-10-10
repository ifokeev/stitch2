/**
 * Layout checks for every screen, the bugs we kept hitting in generated designs: content past the screen
 * edge, labels wrapping onto two lines, content hidden under fixed bars, tiny tap targets, low text
 * contrast, and text styles that are not one of DESIGN.md's type levels. Writes design/checks.json, which
 * the canvas shows as badges.
 * Every screen is checked in its own theme, then again in each other theme DESIGN.md defines (designThemes):
 * colours change there, so contrast is checked again, tagged with the theme.
 * Usage: stitch2 check [path filter…] [--shots] [--strict]
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
import { listScreens, ROOT } from './screens.ts'
import { startServer } from './serve.ts'
import { collectText, type Issue, typeIssues } from './typecheck.ts'
import { audit } from './audit.ts'


const args = process.argv.slice(2)
const shots = args.includes('--shots')
const strict = args.includes('--strict')
const filters = args.filter((a) => !a.startsWith('--'))
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
  results[s.path] = [
    ...layout,
    ...themed,
    ...typeIssues(levels, await page.evaluate(collectText)),
    ...reuseIssues(s.path, found),
    ...colourIssues(s.path),
  ]
  if (shots) await shoot(s)
}
await browser.close()
server.close()

async function setTheme(theme: string) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t
  }, theme)
  await page.waitForTimeout(150)
}

/** A page-tall render; renders in another theme than the screen's own get a --<theme> suffix. */
async function shoot(s: { path: string; width: number }, theme?: string) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.setViewportSize({ width: s.width, height: Math.max(844, Math.min(height, 6000)) })
  mkdirSync(join(ROOT, 'renders'), { recursive: true })
  const name = s.path.replaceAll('/', '__').replace(/\.html$/, theme ? `--${theme}.png` : '.png')
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
