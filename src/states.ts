/**
 * Interactive states of the component catalog: every control in a catalog (a button, a chip, a row that opens
 * something) drawn at rest, hovered, focused and pressed, forced through the DevTools protocol so the components
 * need nothing extra. check runs it on each catalog: a control whose hover or press changes nothing gives no
 * feedback, and text must keep its contrast in every state. The crops make <design>/states/index.html, the
 * states sheet the canvas opens from its sidebar.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { config } from './config.ts'
import { filterSnippet } from './report-filter.ts'
import { ROOT } from './screens.ts'
import type { Issue } from './typecheck.ts'

export const STATES = ['rest', 'hover', 'focus', 'pressed'] as const
type State = (typeof STATES)[number]
const FORCED: Record<State, string[]> = { rest: [], hover: ['hover'], focus: ['focus', 'focus-visible'], pressed: ['hover', 'active'] }
/** Controls drawn per catalog, so a long catalog stays quick to check. */
const MAX_CONTROLS = 80

interface Control {
  i: number
  name: string
  label: string
  selector: string
  /** A text field: its states are focus and contrast (hover and press feedback belong to buttons and links). */
  field: boolean
  /** Already chosen (a selected chip, the current tab): it shows that, and pressing it again does nothing. */
  chosen: boolean
  /** Clicked to act (a button, a link, a switch, a select): the pointer shows the hand over it (state-cursor). */
  clickable: boolean
}
export interface StateRow {
  name: string
  label: string
  selector: string
  /** The crop's width in CSS px (the picture is twice that on a 2x render). */
  width?: number
  crops: Partial<Record<State, string>>
  notes: string[]
}

/** Runs in the page: one control of each kind and look per component, marked data-s2-state. */
function findControls(opts: { attr: string; max: number }): Control[] {
  const SEL = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="switch"], [role="tab"], [role="checkbox"], [role="radio"], [role="option"], [tabindex]:not([tabindex="-1"])'
  const path = (el: Element) => {
    const parts: string[] = []
    for (let e: Element | null = el; e && e !== document.body && parts.length < 6; e = e.parentElement) {
      let p = e.tagName.toLowerCase()
      const same = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e!.tagName) : []
      if (same.length > 1) p += ':nth-of-type(' + (same.indexOf(e) + 1) + ')'
      parts.unshift(p)
    }
    return parts.join(' > ')
  }
  const seen = new Set<string>()
  const out: Control[] = []
  for (const root of document.querySelectorAll('[' + opts.attr + ']')) {
    const name = root.getAttribute(opts.attr) || ''
    const controls = root.matches(SEL) ? [root] : [...root.querySelectorAll(SEL)]
    for (const c of controls) {
      // The innermost component owns a control: a button inside a card belongs to the button.
      if (c.closest('[' + opts.attr + ']') !== root && !c.matches('[' + opts.attr + ']')) continue
      const h = c as HTMLElement
      const r = h.getBoundingClientRect()
      if (!r.width || !r.height || (h as HTMLButtonElement).disabled || h.getAttribute('aria-disabled') === 'true') continue
      const key = name + '|' + h.tagName + '|' + h.className + '|' + (h.getAttribute('aria-pressed') ?? '') + (h.getAttribute('aria-selected') ?? '')
      if (seen.has(key) || out.length >= opts.max) continue
      seen.add(key)
      const label = (h.getAttribute('aria-label') || h.textContent || h.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
      h.setAttribute('data-s2-state', String(out.length))
      const field = h.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]')
      const chosen = ['aria-pressed', 'aria-selected', 'aria-checked'].some((a) => h.getAttribute(a) === 'true') || (h.hasAttribute('aria-current') && h.getAttribute('aria-current') !== 'false')
      const clickable = h.matches('button, a[href], summary, select, [role="button"], [role="switch"], [role="tab"], [role="checkbox"], [role="radio"], [role="option"], [role="menuitem"], input:is([type="checkbox"], [type="radio"], [type="range"], [type="file"], [type="color"], [type="submit"], [type="button"], [type="reset"])')
      out.push({ i: out.length, name, label, selector: path(h), field, chosen, clickable })
    }
  }
  return out
}

/** Runs in the page: how a control looks (itself and what it holds), and its text's contrast on its background. */
function lookOf(i: number) {
  const el = document.querySelector('[data-s2-state="' + i + '"]') as HTMLElement
  const props = (e: Element) => {
    const c = getComputedStyle(e)
    // translate, scale and rotate are their own properties in Tailwind v4 (active:translate-y-px), apart from transform.
    // The background image is where a state layer lives when it is a gradient laid over whatever the control's fill is.
    return [c.backgroundColor, c.backgroundImage, c.color, c.borderColor, c.outlineStyle === 'none' ? '' : c.outlineColor + c.outlineWidth, c.boxShadow, c.transform, c.translate, c.scale, c.rotate, c.opacity, c.textDecorationLine, c.fill, c.stroke, c.filter].join('|')
  }
  const look = [el, ...el.querySelectorAll('*')].slice(0, 12).map(props).join('#')
  const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number)
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
  }
  let bg: number[] = [255, 255, 255]
  for (let e: Element | null = el; e; e = e.parentElement) {
    const c = rgb(getComputedStyle(e).backgroundColor)
    if (c.length >= 3 && (c[3] ?? 1) >= 0.95) { bg = c; break }
  }
  let worst = 21
  for (const t of [el, ...el.querySelectorAll('*')]) {
    if (![...t.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue
    const cs = getComputedStyle(t)
    const fg = rgb(cs.color)
    if ((fg[3] ?? 1) < 0.5 || Number(cs.opacity) < 0.5) continue
    const [a, b] = [lum(fg), lum(bg)]
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700)
    worst = Math.min(worst, ratio / (large ? 3 : 4.5))
  }
  return { look, contrast: worst, cursor: getComputedStyle(el).cursor }
}

/**
 * The controls (by their index in the page) whose hover still changes them where nothing can hover. The page is loaded
 * again in a touch context, which turns the hover media feature off, and each control is looked at with and without
 * :hover forced. A fresh context, not touch emulation on the same page: switching emulation off again does not give
 * every platform its pointer back, and the rest of the check must see the page as it was.
 */
async function hoverStaysOnTouch(page: Page, controls: Control[]): Promise<Set<number>> {
  const stays = new Set<number>()
  const browser = page.context().browser()
  if (!browser) return stays
  const viewport = page.viewportSize()
  const context = await browser.newContext({ hasTouch: true, ...(viewport ? { viewport } : {}) })
  try {
    const touch = await context.newPage()
    const url = page.url()
    if (/^https?:|^file:/.test(url)) {
      await touch.goto(url, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {})
      await touch.waitForTimeout(300)
    } else await touch.setContent(await page.content())
    if (await touch.evaluate(() => matchMedia('(hover: hover)').matches)) return stays
    const there = await touch.evaluate(findControls, { attr: 'data-' + config.prefix, max: MAX_CONTROLS })
    await touch.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }' })
    const cdp = await context.newCDPSession(touch)
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
    const frame = () => touch.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    for (const c of controls) {
      const same = there.find((t) => t.selector === c.selector && t.label === c.label)
      if (!same) continue
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-s2-state="' + same.i + '"]' })
      if (!nodeId) continue
      const rest = await touch.evaluate(lookOf, same.i)
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] })
      await frame()
      const hovered = await touch.evaluate(lookOf, same.i)
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
      if (hovered.look !== rest.look) stays.add(c.i)
    }
    await cdp.detach()
  } finally {
    await context.close()
  }
  return stays
}

/**
 * The states of every control in the catalog open in the page, in the current theme. With crop, saves a picture
 * of each state under <design>/states/ and returns the rows of the sheet.
 */
export async function catalogStates(page: Page, path: string, opts: { crop: boolean; theme?: string }): Promise<{ issues: Issue[]; rows: StateRow[] }> {
  const controls = await page.evaluate(findControls, { attr: 'data-' + config.prefix, max: MAX_CONTROLS })
  const still = await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }' })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
  const issues: Issue[] = []
  const rows: StateRow[] = []
  const tag = opts.theme ? opts.theme + ' theme: ' : ''
  const dir = join(ROOT, 'states')
  // Controls whose hover changes them, to look at again on a device that cannot hover.
  const hoverable: { c: Control; who: string }[] = []
  for (const c of controls) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-s2-state="' + c.i + '"]' })
    if (!nodeId) continue
    const looks: Partial<Record<State, { look: string; contrast: number; cursor: string }>> = {}
    const row: StateRow = { name: c.name, label: c.label, selector: c.selector, crops: {}, notes: [] }
    const el = page.locator('[data-s2-state="' + c.i + '"]')
    await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
    for (const state of STATES) {
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: FORCED[state] })
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      looks[state] = await page.evaluate(lookOf, c.i)
      if (opts.crop) {
        const box = await el.boundingBox()
        if (box && box.width >= 1 && box.height >= 1) {
          const pad = 8
          const file = path.replace(/[^a-z0-9]+/gi, '_') + '/' + c.i + '-' + state + '.png'
          mkdirSync(join(dir, file, '..'), { recursive: true })
          await page.screenshot({ path: join(dir, file), clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 } })
          row.crops[state] = file
          row.width = Math.round(box.width + pad * 2)
        }
      }
    }
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
    const who = c.name + (c.label ? ' “' + c.label + '”' : '')
    const add = (type: string, message: string) => {
      issues.push({ severity: 'warning', type, selector: c.selector, text: c.label, message: tag + message, ...(opts.theme ? { theme: opts.theme } : {}) })
      row.notes.push(tag + message)
    }
    const noHover = looks.hover?.look === looks.rest?.look
    if (c.clickable && !c.field && !c.chosen && !noHover) hoverable.push({ c, who })
    // Pressed is forced on top of hover: a press that adds nothing to hover shows nothing on a touch screen.
    const noPress = looks.pressed?.look === looks.hover?.look
    if (c.clickable && !c.field && !c.chosen) {
      if (noHover && noPress) add('state-feedback', who + ': neither hovering nor pressing changes it, so a pointer or a tap gives no feedback (DESIGN.md, hover and pressed)')
      else if (noHover) add('state-hover', who + ': hovering changes nothing, so a pointer gives no feedback (DESIGN.md, hover)')
      else if (noPress) add('state-pressed', who + ': pressing adds nothing to hover, so a tap gives no feedback (DESIGN.md, pressed)')
    }
    if (!c.clickable && !c.field && looks.focus?.look === looks.rest?.look)
      add('state-focus', who + ': this keyboard-focusable region needs a visible focus indicator, not hover or pressed feedback')
    // The hand says "this does something" before the click; the arrow over a button reads as plain text.
    const cursor = looks.hover?.cursor
    if (c.clickable && cursor && cursor !== 'pointer')
      add('state-cursor', who + ': the pointer shows "' + cursor + '" over it, not the hand, so it doesn\'t look clickable (stitch2 tokens writes the rule; a component overrides it)')
    for (const state of ['hover', 'focus', 'pressed'] as const)
      if ((looks[state]?.contrast ?? 21) < 1 && (looks.rest?.contrast ?? 21) >= 1) {
        add('state-contrast', who + ': low text contrast when ' + (state === 'focus' ? 'focused' : state === 'hover' ? 'hovered' : 'pressed'))
        break
      }
    rows.push(row)
  }
  // On a phone or a tablet nothing hovers, and a tap leaves the pointer where it landed: a hover rule outside
  // @media (hover: hover) keeps the control lit until the next tap. Only the base theme is looked at (the rest of
  // the themes are read for contrast).
  if (hoverable.length && !opts.theme) {
    const stays = await hoverStaysOnTouch(page, hoverable.map((h) => h.c))
    for (const { c, who } of hoverable) {
      if (!stays.has(c.i)) continue
      const message = tag + who + ': hovering still changes it on a device that cannot hover, so a tap leaves it lit (draw hover inside @media (hover: hover))'
      issues.push({ severity: 'warning', type: 'state-hover-touch', selector: c.selector, text: c.label, message })
      rows.find((r) => r.selector === c.selector && r.label === c.label)?.notes.push(message)
    }
  }
  await cdp.detach()
  await still.evaluate((n) => (n as Element).remove())
  await page.evaluate(() => document.querySelectorAll('[data-s2-state]').forEach((n) => n.removeAttribute('data-s2-state')))
  return { issues, rows }
}

const esc = (s: unknown) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

/** Writes the states sheet, keeping the rows of catalogs this run didn't check (states/states.json). */
export function writeStatesSheet(fresh: Record<string, StateRow[]>, catalogs: string[]) {
  const dir = join(ROOT, 'states')
  mkdirSync(dir, { recursive: true })
  const store = join(dir, 'states.json')
  let all: Record<string, StateRow[]> = {}
  try {
    all = JSON.parse(readFileSync(store, 'utf8'))
  } catch {}
  all = Object.fromEntries(Object.entries({ ...all, ...fresh }).filter(([p]) => catalogs.includes(p)))
  writeFileSync(store, JSON.stringify(all, null, 1))
  const sections = Object.entries(all)
    .map(([path, rows]) => {
      const byName = new Map<string, StateRow[]>()
      for (const r of rows) byName.set(r.name, [...(byName.get(r.name) ?? []), r])
      const groups = [...byName.entries()]
        .map(
          ([name, list]) =>
            '<h3>' + esc(name) + '</h3>' +
            list
              .map(
                (r) =>
                  '<div class="row"><div class="who"><b>' + esc(r.label || name) + '</b><code>' + esc(r.selector) + '</code>' +
                  (r.notes.length ? r.notes.map((n) => '<p class="bad">' + esc(n) + '</p>').join('') : '<span class="ok">every state differs</span>') +
                  '</div><div class="imgs">' +
                  STATES.map((st) => '<figure>' + (r.crops[st] ? '<img src="' + esc(r.crops[st]) + '" alt=""' + (r.width ? ' width="' + Math.min(r.width, 360) + '"' : '') + ' />' : '<span class="none">—</span>') + '<figcaption>' + st + '</figcaption></figure>').join('') +
                  '</div></div>',
              )
              .join(''),
        )
        .join('')
      return '<section data-path="' + esc(path) + '"><h2>' + esc(path) + '</h2>' + groups + '</section>'
    })
    .join('')
  writeFileSync(
    join(dir, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>States</title><style>' +
      'body { background: #0f0f11; color: #f4f4f5; font: 14px/1.5 system-ui, sans-serif; margin: 0; } main { margin: 0 auto; max-width: 1200px; padding: 32px; }' +
      'h1 { font-size: 26px; margin: 0 0 4px; } h2 { font: 13px ui-monospace, monospace; color: #a1a1aa; margin: 40px 0 0; } h3 { font-size: 17px; margin: 28px 0 8px; } code { color: #71717a; font: 12px ui-monospace, monospace; }' +
      '.row { border-top: 1px solid #2e2e33; display: grid; gap: 20px; grid-template-columns: 280px 1fr; padding: 12px 0; } .who { display: grid; gap: 4px; align-content: start; min-width: 0; overflow-wrap: anywhere; }' +
      '.imgs { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; } figure { margin: 0; } figcaption { color: #71717a; font-size: 12px; margin-top: 4px; } img { background: #000; border: 1px solid #2e2e33; border-radius: 6px; display: block; max-width: 360px; }' +
      '.ok { color: #3fb27f; } .bad { color: #e5b54a; margin: 0; font-size: 13px; } .none { color: #71717a; }' +
      '</style></head><body><main><h1>States</h1><code>' + new Date().toISOString() + ' · every control in the component catalog at rest, hovered, focused and pressed</code><p id="stitch2-filter" hidden></p>' +
      sections +
      '</main>' + filterSnippet + '</body></html>\n',
  )
}

export const statesSheetExists = () => existsSync(join(ROOT, 'states/index.html'))
