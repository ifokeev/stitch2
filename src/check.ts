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

/** Runs inside the page. Plain JS on purpose: Playwright sends its source to the browser. */
async function audit(opts: { comfortable: number }): Promise<Issue[]> {
  const W = document.documentElement.clientWidth
  const out: Issue[] = []
  const sel = (el: Element) => {
    const parts: string[] = []
    for (let e: Element | null = el; e && e !== document.body && parts.length < 6; e = e.parentElement) {
      if (e.id) {
        parts.unshift(`#${CSS.escape(e.id)}`)
        break
      }
      let p = e.tagName.toLowerCase()
      const same = e.parentElement
        ? [...e.parentElement.children].filter((c) => c.tagName === e!.tagName)
        : []
      if (same.length > 1) p += `:nth-of-type(${same.indexOf(e) + 1})`
      parts.unshift(p)
    }
    return parts.join(' > ')
  }
  const text = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
  const push = (severity: Issue['severity'], type: string, el: Element, message: string) => {
    if (out.filter((i) => i.type === type).length >= 10) return
    out.push({ severity, type, message, selector: sel(el), text: text(el) })
  }
  const shown = (el: Element) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const opacity = (el: Element) => {
    let o = 1
    for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity)
    return o
  }
  const ownText = (el: Element) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())
  const inSvg = (el: Element) => !!el.closest('svg') && el.tagName.toLowerCase() !== 'svg'
  const all = [...document.body.querySelectorAll('*')].filter((el) => shown(el) && !inSvg(el))
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  // 1. Nothing past the screen edge, except inside deliberate horizontal scrollers (chip rows).
  if (document.documentElement.scrollWidth > W + 1)
    push(
      'error',
      'page-overflow',
      document.body,
      `The page scrolls sideways (${document.documentElement.scrollWidth}px wide)`,
    )
  const overflowing = new Set<Element>()
  for (const el of all) {
    const r = el.getBoundingClientRect()
    if (r.right <= W + 1 && r.left >= -1) continue
    let clip: string | null = null
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox !== 'visible') {
        clip = ox
        break
      }
    }
    if (clip === 'auto' || clip === 'scroll') continue
    if (overflowing.has(el.parentElement!)) {
      overflowing.add(el)
      continue
    }
    overflowing.add(el)
    if (clip) {
      if (ownText(el)) push('warning', 'clipped', el, 'Text is cut off at the screen edge')
    } else push('error', 'overflow', el, `Sticks out past the screen edge (${Math.round(r.right - W)}px)`)
  }

  // 2. Short labels (buttons, chips, tabs) stay on one line.
  const isLabel = (el: Element) =>
    el.matches('button, a, label, [role=tab], [role=button], [role=switch], th') ||
    /(^|\s)(chip|badge|pill|tag)|rounded-full/.test(String((el as HTMLElement).className ?? ''))
  for (const el of all) {
    if (!isLabel(el) || text(el).length > 40 || el.querySelector('p, div, li, ul, br')) continue
    // A wrap is one text node breaking across lines; an icon above its label is layout, not a wrap.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent!.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      const tops = [...range.getClientRects()].filter((r) => r.width > 1).map((r) => r.top + r.height / 2)
      const lineHeight = parseFloat(getComputedStyle(n.parentElement!).fontSize) || 14
      if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > lineHeight * 0.6) {
        push('error', 'label-wraps', el, 'Label wraps onto two lines')
        break
      }
    }
  }

  // 3. Fixed bars (tab bar, rest timer, headers) never cover content: check at both scroll ends.
  const bars = all.filter((el) => {
    const p = getComputedStyle(el).position
    const r = el.getBoundingClientRect()
    return (p === 'fixed' || p === 'sticky') && r.height <= 240 && r.width >= W * 0.6
  })
  const outer = bars.filter((b) => !bars.some((o) => o !== b && o.contains(b)))
  const content = all.filter(
    (el) =>
      !outer.some((b) => b.contains(el)) &&
      (ownText(el) || el.matches('button, input, select, textarea, img, svg, canvas, video')) &&
      opacity(el) > 0.5,
  )
  const covered = async (edge: 'top' | 'bottom') => {
    window.scrollTo(0, edge === 'bottom' ? document.documentElement.scrollHeight : 0)
    await frame()
    const H = window.innerHeight
    for (const bar of outer) {
      const b = bar.getBoundingClientRect()
      const atEdge = edge === 'bottom' ? b.bottom >= H - 4 && b.top > H / 2 : b.top <= 4 && b.bottom < H / 2
      if (!atEdge) continue
      for (const el of content) {
        if (el.contains(bar)) continue
        const r = el.getBoundingClientRect()
        const overlapY = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)
        const overlapX = Math.min(r.right, b.right) - Math.max(r.left, b.left)
        if (overlapY > 4 && overlapX > 4)
          push(
            'error',
            `under-${edge}-bar`,
            el,
            `Hidden under the fixed ${edge} bar when scrolled to the ${edge} (add padding)`,
          )
      }
    }
  }
  await covered('bottom')
  await covered('top')
  window.scrollTo(0, 0)

  // 4. Tap targets: WCAG 2.2 asks for at least 24px; smaller than the config's comfortableTarget is a warning.
  const interactive = all.filter((el) =>
    el.matches(
      'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox]',
    ),
  )
  for (const el of interactive) {
    if (interactive.some((o) => o !== el && o.contains(el))) continue
    if (el.matches('a') && el.closest('p')) continue
    const r = el.getBoundingClientRect()
    const min = Math.min(r.width, r.height)
    // WCAG 2.2 spacing exception: a smaller target passes when a 24px circle on it touches no other target.
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const crowded = interactive.some((o) => {
      if (o === el || o.contains(el) || el.contains(o)) return false
      const q = o.getBoundingClientRect()
      const dx = Math.max(q.left - cx, 0, cx - q.right)
      const dy = Math.max(q.top - cy, 0, cy - q.bottom)
      return Math.hypot(dx, dy) < 12
    })
    if (min < 24 && crowded)
      push(
        'error',
        'tap-target',
        el,
        'Too small to tap and crowded (' +
          Math.round(r.width) +
          '×' +
          Math.round(r.height) +
          'px, minimum 24)',
      )
    else if (min < 24)
      push('warning', 'tap-target', el, `Small tap target (${Math.round(r.width)}×${Math.round(r.height)}px)`)
    else if (min < opts.comfortable)
      push('warning', 'tap-target', el, `Small tap target (${Math.round(r.width)}×${Math.round(r.height)}px)`)
  }

  // 5. Text contrast (WCAG AA): 4.5:1, or 3:1 for large text. Skips text over images and dimmed layers.
  const rgba = (c: string) => {
    const m = /rgba?\(([^)]+)\)/.exec(c)
    if (!m) return null
    const [r, g, b, a = '1'] = m[1]!.split(/[\s,/]+/).filter(Boolean)
    return [Number(r), Number(g), Number(b), Number(a)]
  }
  const lum = (c: number[]) => {
    const f = (v: number) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!)
  }
  const over = (top: number[], under: number[]) => {
    const a = top[3]!
    return [0, 1, 2].map((i) => top[i]! * a + under[i]! * (1 - a)).concat(1)
  }
  for (const el of all) {
    // WCAG exempts disabled controls from contrast.
    if (!ownText(el) || opacity(el) < 0.6 || el.matches('input, textarea, select, option')) continue
    if (el.closest('[disabled], [aria-disabled="true"]')) continue
    const layers: number[][] = []
    let image = false
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.backgroundImage !== 'none') {
        image = true
        break
      }
      const c = rgba(cs.backgroundColor)
      if (c && c[3]! > 0) {
        layers.push(c)
        if (c[3] === 1) break
      }
    }
    if (image) continue
    let bg = [255, 255, 255, 1]
    for (const l of layers.reverse()) bg = over(l, bg)
    const fgRaw = rgba(getComputedStyle(el).color)
    if (!fgRaw) continue
    const fg = over(fgRaw, bg)
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
    const ratio = (a! + 0.05) / (b! + 0.05)
    const cs = getComputedStyle(el)
    const size = parseFloat(cs.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
    const need = large ? 3 : 4.5
    if (ratio < need)
      push(
        ratio < need - 1 ? 'error' : 'warning',
        'contrast',
        el,
        `Low contrast ${ratio.toFixed(2)}:1 (needs ${need}:1)`,
      )
  }
  return out.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === 'error' ? -1 : 1))
}

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
