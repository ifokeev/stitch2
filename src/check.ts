/**
 * Layout checks for every screen, the bugs we kept hitting in generated designs: content past the screen
 * edge, labels wrapping onto two lines, content hidden under fixed bars, tiny tap targets, low text
 * contrast, and text styles that are not one of DESIGN.md's type levels. Writes design/checks.json, which
 * the canvas shows as badges.
 * Usage: stitch2 check [path filter…] [--shots] [--strict]
 *   --shots   also save page-tall renders to design/renders/
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
import { typeLevels } from './design-md.ts'
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
  results[s.path] = [
    ...(await page.evaluate(audit, { comfortable: config.comfortableTarget })),
    ...typeIssues(levels, await page.evaluate(collectText)),
    ...reuseIssues(s.path, found),
    ...colourIssues(s.path),
  ]
  if (shots) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: s.width, height: Math.max(844, Math.min(height, 6000)) })
    mkdirSync(join(ROOT, 'renders'), { recursive: true })
    await page.screenshot({
      path: join(ROOT, 'renders', s.path.replaceAll('/', '__').replace(/\.html$/, '.png')),
    })
  }
}
await browser.close()
server.close()

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
