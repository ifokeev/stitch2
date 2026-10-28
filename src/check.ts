/**
 * Layout checks for every screen, the bugs we kept hitting in generated designs: content past the screen
 * edge, labels wrapping onto two lines, content hidden under fixed bars, tiny tap targets, low text
 * contrast, and text styles that are not one of DESIGN.md's type levels. Writes design/checks.json, which
 * the canvas shows as badges.
 * Every screen is checked in its own theme, then again in each other theme DESIGN.md defines (designThemes):
 * colours change there, so contrast is checked again, tagged with the theme.
 * Then in each app state (config modes), one mode at a time and in the screen's own theme: a screen is checked with
 * every value its own file does not already have, and what only shows there (a bar that overflows signed in, a control
 * that crowds another) is tagged with the state.
 * Then again in each check language (i18n.ts: the pseudo-languages and the config's): layout problems that
 * show only there (a label running into its neighbour, text cut off, a control drawn backwards right to left),
 * and keys a locale has no translation for, tagged with the locale. Last, each variant at both ends of the widths
 * it covers (config widths: mobile 360–599, desktop 1024–1920 by default) and at every breakpoint inside them
 * (config breakpoints, Tailwind's by default), tagged with the width.
 * Usage: stitch2 check [path filter…] [--shots] [--strict] [--locales ru,ar | all | none]
 *   --shots   also save page-tall renders to design/renders/ (one per theme, app state, language and width)
 *   --strict  exit 1 when any screen has errors (for CI and agent loops)
 *   --archived  also check archived versions, which are left out otherwise: they are outdated (superseded or rejected),
 *             hidden on the canvas, and nothing is built from them, so checking them costs time and reports errors in history
 * Screens run four at a time; reruns only visit screens that changed since design/checks.json (or
 * everything DESIGN.md, the tokens, the components, the catalog or stitch2 itself changed since: a first run after
 * that visits every screen and takes minutes on a large project). Progress goes to stderr, one line per screen
 * ("check: 37/588 …, about 14 min left"). design/checks.json is saved as screens finish and when the run is stopped
 * (Ctrl-C, kill), so the next run continues with the screens that are left instead of starting over.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { fingerprintPaths } from './cache.ts'
import { colourIssues } from './colours.ts'
import { CONFIG_FILE, checkWidths, config, modes } from './config.ts'
import {
  type Components,
  collectComponents,
  collectOptions,
  consistencyIssues,
  reuseIssues,
} from './consistency.ts'
import { designThemes, motionDurations, readDesign, typeLevels } from './design-md.ts'
import { checkLocales } from './i18n.ts'
import { listScreens, ROOT } from './screens.ts'
import { startServer } from './serve.ts'
import { catalogStates, type StateRow, writeStatesSheet } from './states.ts'
import { collectText, type Issue, typeIssues } from './typecheck.ts'
import { audit, movingAnimations } from './audit.ts'


const args = process.argv.slice(2)
const shots = args.includes('--shots')
const strict = args.includes('--strict')
const localesFlag = args.indexOf('--locales')
const locales = checkLocales(localesFlag >= 0 ? args[localesFlag + 1] : undefined)
const filters = args.filter((a, i) => !a.startsWith('--') && (localesFlag < 0 || i !== localesFlag + 1))
const matching = listScreens().filter((s) => !filters.length || filters.some((f) => s.path.includes(f)))
const screens = args.includes('--archived') ? matching : matching.filter((s) => s.status !== 'archived')
const archivedLeftOut = matching.length - screens.length
if (archivedLeftOut)
  console.log(`${archivedLeftOut} archived screen${archivedLeftOut === 1 ? ' is' : 's are'} not checked (--archived includes ${archivedLeftOut === 1 ? 'it' : 'them'}).`)
if (!screens.length && matching.length) process.exit(0)

const levels = typeLevels()
const themes = designThemes()
const appModes = modes()
const collect = collectOptions()
/** What the layout audit needs: the comfortable tap size, DESIGN.md's motion durations and its secondary text colour (text-muted, for text-tier). */
const auditOpts = {
  comfortable: config.comfortableTarget,
  durations: (() => { try { return motionDurations() } catch { return [] } })(),
  secondary: (() => { try { return 'text-muted' in readDesign().colors ? 'var(--' + config.prefix + '-text-muted)' : undefined } catch { return undefined } })(),
}
const server = await startServer(0)
/** The tallest render, in CSS px: a long landing page is shot whole (the canvas draws frames up to the same height). */
const MAX_RENDER_HEIGHT = 20000

const fresh = async () => {
  // Signals are handled below: a stopped run saves what it has before the browsers close.
  const browser = await chromium.launch({ handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  return { browser, page, visits: 0 }
}
type Worker = Awaited<ReturnType<typeof fresh>>
const CONCURRENCY = 4
const pool = await Promise.all(Array.from({ length: CONCURRENCY }, fresh))
const results: Record<string, Issue[]> = {}
const components: Record<string, Components> = {}
const stateRows: Record<string, StateRow[]> = {}
// Screens unchanged since the last green run keep their results when nothing they depend on changed
// (DESIGN.md, tokens, components, the catalog): reruns then only visit what actually changed.
let previous: {
  screens?: Record<string, Issue[]>
  components?: Record<string, Components>
  checkedAt?: string
  cacheKeys?: Record<string, string>
} = {}
try {
  previous = JSON.parse(readFileSync(join(ROOT, 'checks.json'), 'utf8'))
} catch {}
const currentDeps = fingerprintPaths([
  ...['DESIGN.md', 'tokens.css', 'tokens.json', 'components', config.catalogDir].map((p) => join(ROOT, p)),
  ...(CONFIG_FILE ? [CONFIG_FILE] : []),
  fileURLToPath(new URL('.', import.meta.url)),
])
// Renders are the point of --shots: every screen is visited, nothing is skipped.
// ...as are explicit locales: different flags check different things.
const runKey = JSON.stringify({ locales, shots })
// Each screen remembers its own inputs. A filtered run cannot bless unvisited screens after a shared edit.
const cacheKeys = Object.fromEntries(screens.map((s) => [
  s.path, `${currentDeps}:${runKey}:${fingerprintPaths([join(ROOT, s.path)])}`,
]))
const todo = screens.filter(
  (s) => shots || !previous.screens?.[s.path] || previous.cacheKeys?.[s.path] !== cacheKeys[s.path]
    || previous.screens[s.path].some((i) => i.type === 'check-crashed'),
)
for (const s of screens) {
  if (!todo.includes(s)) {
    results[s.path] = previous.screens![s.path]!
    if (previous.components?.[s.path]) components[s.path] = previous.components[s.path]
  }
}
const exists = new Set(listScreens().map((s) => s.path))
const keep = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([p]) => exists.has(p)))
const freshPreviousComponents = Object.fromEntries(Object.entries(previous.components ?? {})
  .filter(([path]) => previous.cacheKeys?.[path]?.startsWith(`${currentDeps}:`)
    && previous.cacheKeys[path]!.endsWith(`:${fingerprintPaths([join(ROOT, path)])}`)))

// What this run has finished is saved while it runs, not only at the end: a run that is stopped, killed or crashes
// keeps its screens (their cache keys are current), and the next run visits only the rest. Written to a temporary
// file and renamed, so the canvas never reads half a file.
const writeChecks = (data: { cacheKeys: Record<string, string>; screens: Record<string, Issue[]>; components: Record<string, Components> }) => {
  const file = join(ROOT, 'checks.json')
  writeFileSync(`${file}.tmp`, `${JSON.stringify({ checkedAt: new Date().toISOString(), ...data }, null, 2)}\n`)
  renameSync(`${file}.tmp`, file)
}
/** Screens finished in this run. Catalogs wait for the end: their States sheet is only written then. */
const finished: string[] = []
let lastSaved = Date.now()
const saveProgress = () => {
  const keys = { ...previous.cacheKeys }
  const rows = { ...previous.screens }
  for (const p of finished) {
    keys[p] = cacheKeys[p]!
    rows[p] = results[p]!
  }
  writeChecks({ cacheKeys: keep(keys), screens: keep(rows), components: keep({ ...freshPreviousComponents, ...components }) })
  lastSaved = Date.now()
}
const note = (line: string) => process.stderr.write(`check: ${line}\n`)
const duration = (seconds: number) =>
  seconds < 90 ? `${Math.round(seconds)} s` : seconds < 5400 ? `${Math.round(seconds / 60)} min` : `${(seconds / 3600).toFixed(1)} h`
const sharedChanged =
  !!previous.cacheKeys && screens.length > 0 && screens.every((s) => !previous.cacheKeys![s.path]?.startsWith(`${currentDeps}:`))
if (!todo.length) note(`all ${screens.length} screens are unchanged since the last run`)
else if (todo.length < screens.length)
  note(`visiting ${todo.length} of ${screens.length} screens; the others are unchanged since the last run`)
else
  note(
    `visiting all ${screens.length} screens` +
      (shots
        ? ' (--shots renders every one)'
        : sharedChanged
          ? ' (DESIGN.md, the tokens, the components, the catalog or stitch2 itself changed, which rechecks every screen)'
          : ''),
  )
if (todo.length > 40) note('this takes a while: the finished screens are kept, so stopping it (Ctrl-C) loses nothing')
let stopping = false
let finalising = false
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]] as const)
  process.on(signal, () => {
    // Everything is visited: the last write below is quick, and a partial save must not replace it.
    if (finalising) process.exit(code)
    if (stopping) return
    stopping = true
    saveProgress()
    note(`stopped with ${finished.length} of ${todo.length} screens finished; they are kept, run it again to continue`)
    const closed = Promise.all(pool.map((w) => w.browser.close().catch(() => {})))
    void Promise.race([closed, new Promise((r) => setTimeout(r, 3000))]).finally(() => process.exit(code))
  })
const checkOne = async (s: (typeof screens)[number], worker: Worker): Promise<void> => {
  if (worker.visits > 0 && worker.visits % 20 === 0) {
    // A check loads each screen several times (themes, languages, widths); a fresh browser keeps long
    // runs alive.
    await worker.page.close().catch(() => {})
    await worker.browser.close().catch(() => {})
    const next = await fresh()
    worker.browser = next.browser
    worker.page = next.page
  }
  worker.visits++
  const page = worker.page
  try {
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
  const layout = await page.evaluate(audit, auditOpts)
  // With reduced motion asked for, nothing keeps moving (DESIGN.md motion, WCAG 2.3.3).
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(100)
  layout.push(...(await page.evaluate(movingAnimations)))
  await page.emulateMedia({ reducedMotion: null })
  for (const i of layout) if (i.type === 'contrast') i.theme = base
  // The other themes: what the colours change (contrast), plus anything that only shows there.
  const seen = new Set(layout.map((i) => `${i.type} ${i.selector}`))
  const themed: Issue[] = []
  for (const theme of themes.filter((t) => t !== base)) {
    await setTheme(page, theme)
    for (const i of await page.evaluate(audit, auditOpts))
      if (i.type === 'contrast' || !seen.has(`${i.type} ${i.selector}`))
        themed.push({ ...i, theme, message: `${theme} theme: ${i.message}` })
    if (shots) await shoot(page, s, theme)
  }
  if (themes.length > 1) await setTheme(page, base)
  // The app states: each value the screen is not drawn in, one mode at a time, then the screen's own value again.
  for (const mode of appModes) {
    const drawn = await page.evaluate((attribute) => document.documentElement.getAttribute(attribute), mode.attribute)
    for (const value of mode.values.filter((v) => v.value !== drawn)) {
      await setAttribute(page, mode.attribute, value.value)
      for (const i of await page.evaluate(audit, auditOpts)) {
        const key = `${i.type} ${i.selector}`
        if (seen.has(key)) continue
        seen.add(key)
        themed.push({ ...i, ...(i.type === 'contrast' ? { theme: base } : {}), mode: `${mode.name}:${value.value}`, message: `${value.label}: ${i.message}` })
      }
      if (shots) await shoot(page, s, undefined, undefined, `${mode.name}-${value.value}`)
    }
    await setAttribute(page, mode.attribute, drawn)
  }
  const typed = typeIssues(levels, await page.evaluate(collectText))
  if (shots) await shoot(page, s)
  // A catalog: every control at rest, hovered, focused and pressed (states.ts), then its contrast in each theme.
  const states: Issue[] = []
  if (s.kind === 'components') {
    const own = await catalogStates(page, s.path, { crop: true })
    states.push(...own.issues)
    stateRows[s.path] = own.rows
    for (const theme of themes.filter((t) => t !== base)) {
      await setTheme(page, theme)
      states.push(...(await catalogStates(page, s.path, { crop: false, theme })).issues.filter((i) => i.type === 'state-contrast'))
    }
    if (themes.length > 1) await setTheme(page, base)
  }
  // The other languages, in the screen's own theme. Reported once per element and kind, in the first locale.
  const unknownSeen = new Set<string>()
  for (const locale of locales) {
    await page
      .goto(`http://127.0.0.1:${server.port}/${s.path}?lang=${encodeURIComponent(locale)}`, { waitUntil: 'networkidle', timeout: 30_000 })
      .catch(() => {})
    await page.waitForTimeout(600)
    for (const i of await page.evaluate(audit, auditOpts)) {
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
    if (shots) await shoot(page, s, undefined, locale)
  }
  // The edges of the widths this variant covers (config widths) and the breakpoints inside them, in its own theme
  // and language: what breaks only when the window is narrower or wider than the frame it was drawn in.
  for (const width of s.kind === 'screen' ? checkWidths(s.device).filter((w) => w !== s.width) : []) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`http://127.0.0.1:${server.port}/${s.path}`, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(600)
    for (const i of await page.evaluate(audit, auditOpts)) {
      const key = `${i.type} ${i.selector}`
      if (i.type === 'contrast' || seen.has(key)) continue
      seen.add(key)
      themed.push({ ...i, width, message: `at ${width}px: ${i.message}` })
    }
    if (shots) await shoot(page, { ...s, width }, undefined, undefined, `${width}px`)
  }
  await page.setViewportSize({ width: s.width, height: 844 })
    results[s.path] = [
      ...layout,
      ...themed,
      ...typed,
      ...reuseIssues(s.path, found),
      ...colourIssues(s.path),
      ...states,
    ]
  } catch (e) {
    // A dead page must not kill the other workers: record the crash visibly, retry next run.
    results[s.path] = [
      {
        severity: 'error',
        type: 'check-crashed',
        message: `check crashed on this screen (${String(e).split('\n')[0]}): rerun to retry`,
      } as Issue,
    ]
    if (!stopping) console.error(`check: ${s.path} crashed (${String(e).split('\n')[0]}), recorded and continuing`)
  }
}
let cursor = 0
const startedAt = Date.now()
let completed = 0
const progress = (path: string, seconds: number) => {
  completed++
  const left = todo.length - completed
  const eta = completed >= 3 && left > 0 ? `, about ${duration(((Date.now() - startedAt) / 1000 / completed) * left)} left` : ''
  note(`${completed}/${todo.length} ${path} (${duration(seconds)}${eta})`)
}
// One screen per worker at a time: workers pull from the queue, so a page is never shared.
const drive = async (worker: Worker): Promise<void> => {
  while (cursor < todo.length && !stopping) {
    const s = todo[cursor++]!
    const began = Date.now()
    await checkOne(s, worker)
    // A stopped run closes the browsers under the screens still being checked: those are not results.
    if (stopping) return
    if (s.kind !== 'components') finished.push(s.path)
    progress(s.path, (Date.now() - began) / 1000)
    if (Date.now() - lastSaved > 15_000) saveProgress()
  }
}
await Promise.all(pool.map((w) => drive(w)))
// A stopped run has saved and is closing the browsers; the handler above ends the process.
if (stopping) await new Promise(() => {})
finalising = true
await Promise.all(pool.map(async (w) => {
  await w.page.close().catch(() => {})
  await w.browser.close().catch(() => {})
}))
// The states sheet: the catalogs checked now, and the rows of the others from their last check.
if (Object.keys(stateRows).length)
  writeStatesSheet(stateRows, listScreens().filter((s) => s.kind === 'components').map((s) => s.path))
server.close()

async function setTheme(page: Worker['page'], theme: string) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t
  }, theme)
  await page.waitForTimeout(150)
}

async function setAttribute(page: Worker['page'], attribute: string, value: string | null) {
  await page.evaluate(
    ([name, to]) => {
      if (to === null) document.documentElement.removeAttribute(name!)
      else document.documentElement.setAttribute(name!, to)
    },
    [attribute, value],
  )
  await page.waitForTimeout(150)
}

/** A page-tall render; renders in another theme, app state or language than the screen's own get a --<name> suffix. */
async function shoot(
  page: Worker['page'],
  s: { path: string; width: number },
  theme?: string,
  locale?: string,
  at?: string,
) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.setViewportSize({ width: s.width, height: Math.max(844, Math.min(height, MAX_RENDER_HEIGHT)) })
  mkdirSync(join(ROOT, 'renders'), { recursive: true })
  const suffix = theme ?? locale ?? at
  const name = s.path.replaceAll('/', '__').replace(/\.html$/, suffix ? `--${suffix}.png` : '.png')
  await page.screenshot({ path: join(ROOT, 'renders', name) })
  await page.setViewportSize({ width: s.width, height: 844 })
}

const allComponents = keep({ ...freshPreviousComponents, ...components })
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
writeChecks({
  cacheKeys: keep({ ...previous.cacheKeys, ...cacheKeys }),
  screens: keep({ ...previous.screens, ...results }),
  components: allComponents,
})
console.log(
  `\n${screens.length} screens checked, ${errors} errors. Results in design/checks.json (badges on the canvas).`,
)
if (strict && errors) process.exit(1)
