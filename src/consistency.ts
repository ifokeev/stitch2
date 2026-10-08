/**
 * Component consistency across screens. In each page it finds the shared elements (lab components by their
 * data-<prefix> marker; in Stitch exports and hand-written markup by how they look: a fixed bottom bar with three or more
 * buttons, the h1, buttons filled with the primary colour, pill chips, icon-only buttons, caps section labels) and takes a signature of
 * each: size, radius, label font, icon size, and for the tab bar its centre circle. Screens of one family
 * (the Stitch folder, an archive folder, or the lab's own screens) should share one signature per component; check reports
 * the screens that differ from the majority, and lab screens that build a catalog component by hand.
 */

import { config } from './config.ts'
import { readDesign } from './design-md.ts'
import type { Issue } from './typecheck.ts'

export interface Sig {
  selector: string
  text: string
  /** Comparable fields, e.g. { height: '48', font: '15/600/Geist' }. */
  fields: Record<string, string>
}
export type Components = Record<string, Sig[]>
export interface PageComponents {
  components: Components
  handBuilt: { kind: string; selector: string; text: string }[]
}

export interface CollectOptions {
  /** Component marker: elements with data-<prefix>="name". */
  prefix: string
  /** DESIGN.md's primary colour as [r, g, b]: filled buttons in it are primary buttons. */
  primary: number[]
}

/** The options for collectComponents from the config and DESIGN.md's primary colour. */
export function collectOptions(): CollectOptions {
  const hex = (readDesign().colors.primary ?? '#000000').replace('#', '')
  return { prefix: config.prefix, primary: [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) }
}

/** Runs in the page. Plain JS on purpose: Playwright sends its source to the browser. */
export function collectComponents(opts: CollectOptions): PageComponents {
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
  const px = (v: string) => String(Math.round(Number.parseFloat(v) || 0))
  const ownText = (el: Element) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent!.trim())
      .join(' ')
      .trim()
  const isIconFont = (el: Element) => /material|symbols|icons/i.test(getComputedStyle(el).fontFamily)
  const firstText = (root: Element, match?: RegExp) => {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const t = ownText(el)
      if (t && !isIconFont(el) && (!match || match.test(t))) return el
    }
    return null
  }
  const font = (el: Element | null) => {
    if (!el) return ''
    const c = getComputedStyle(el)
    const size = Number.parseFloat(c.fontSize)
    const tr = c.letterSpacing === 'normal' ? 0 : Number.parseFloat(c.letterSpacing) / size
    return `${size}/${c.fontWeight}/${c.fontFamily.split(',')[0]!.replaceAll(/["']/g, '').trim()}${tr ? `/${tr.toFixed(2)}em` : ''}`
  }
  const iconSize = (root: Element) => {
    const i = root.querySelector('svg, i, .material-symbols-outlined, [class*="material-symbols"]')
    return i ? px(String(i.getBoundingClientRect().width)) : ''
  }
  // Which icon set and which glyphs: Lucide SVGs carry lucide-<name>, Material Symbols are ligature text.
  const icons = (root: Element) =>
    [...root.querySelectorAll('svg, [data-lucide], [class*="material-symbols"], .material-icons')]
      .filter((i) => !i.parentElement?.closest('svg'))
      .map((i) => {
        const cls = String(i.getAttribute('class') ?? '')
        const lucide = /\blucide-([a-z0-9-]+)/.exec(cls)?.[1] ?? i.getAttribute('data-lucide')
        if (lucide) return ['lucide', lucide]
        if (/material/.test(cls) || /material|symbols/i.test(getComputedStyle(i).fontFamily))
          return ['material-symbols', (i.textContent ?? '').trim()]
        return ['svg', '']
      })
  const iconSet = (root: Element) => [...new Set(icons(root).map(([s]) => s))].join('+')
  const box = (el: Element) => el.getBoundingClientRect()
  const ember = (el: Element) => getComputedStyle(el).backgroundColor.includes(opts.primary.join(', '))
  const visible = (el: Element) => {
    const r = box(el)
    const c = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'
  }

  const sigOf = (kind: string, el: Element): Sig => {
    const c = getComputedStyle(el)
    const r = box(el)
    const f: Record<string, string> = {}
    const base = kind.split(':')[0]
    if (base === 'tab-bar') {
      f.height = px(String(r.height))
      f.background = c.backgroundColor
      f.label = font(firstText(el))
      f.icon = iconSize(el)
      f.iconSet = iconSet(el)
      f.icons = icons(el)
        .map(([, n]) => n)
        .filter(Boolean)
        .join(',')
      const circle = [...el.querySelectorAll('*')].find(
        (e) => ember(e) && Math.abs(box(e).width - box(e).height) < 2,
      )
      if (circle) {
        f.circle = px(String(box(circle).width))
        f.lift = px(String(r.top - box(circle).top))
      }
      f.centreLabel = /\b(Start|Resume)\b/.test(el.textContent ?? '') ? 'yes' : 'no'
    } else if (base === 'header') {
      f.title = font(el.matches('h1') ? el : (el.querySelector('h1') ?? firstText(el)))
    } else if (base === 'section') {
      f.label = font(el.matches('h2, h3, p, span') ? el : (el.querySelector('h2, h3') ?? firstText(el)))
    } else if (base === 'card') {
      f.radius = px(c.borderTopLeftRadius)
      f.background = c.backgroundColor
    } else if (
      ['card-header', 'stat', 'row', 'chip-row', 'set-row', 'search', 'segmented', 'bar'].includes(base!)
    ) {
      // Their look follows their content; the component guarantees the rest.
    } else {
      f.height = px(String(r.height))
      f.radius = px(c.borderTopLeftRadius)
      f.font = font(firstText(el))
      if (base === 'icon-button') {
        f.icon = iconSize(el)
        f.iconSet = iconSet(el)
        f.width = px(String(r.width))
        f.background = c.backgroundColor
      }
    }
    for (const k of Object.keys(f)) if (!f[k]) delete f[k]
    return {
      selector: sel(el),
      text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
      fields: f,
    }
  }

  const components: Components = {}
  const add = (kind: string, el: Element) => {
    const s = sigOf(kind, el)
    components[kind] ??= []
    if (!components[kind]!.some((x) => JSON.stringify(x.fields) === JSON.stringify(s.fields)))
      components[kind]!.push(s)
  }
  const handBuilt: PageComponents['handBuilt'] = []

  // 1. Lab components announce themselves.
  const marker = `data-${opts.prefix}`
  for (const el of document.querySelectorAll(`[${marker}]`)) {
    if (!visible(el)) continue
    const g = el.getAttribute(marker)!
    const kind =
      g === 'button' ? `button:${el.getAttribute('data-variant')}:${el.getAttribute('data-size')}` : g
    if (!(g === 'button' && el.hasAttribute('disabled'))) add(kind, el)
  }
  // 2. Everything else is recognised by how it looks.
  const H = window.innerHeight
  const W = document.documentElement.clientWidth
  const loose = (el: Element) => !el.closest(`[${marker}]`)
  const all = [...document.body.querySelectorAll('*')].filter((el) => visible(el) && loose(el))
  const found = (kind: string, el: Element) => {
    add(kind, el)
    handBuilt.push({
      kind,
      selector: sel(el),
      text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
    })
  }
  // A tab bar: a full-width bar fixed to the bottom with three or more buttons or links.
  const bar = all.find((el) => {
    const r = box(el)
    return (
      getComputedStyle(el).position === 'fixed' &&
      r.bottom >= H - 2 &&
      r.width >= W * 0.9 &&
      r.height < 140 &&
      el.querySelectorAll('button, a').length >= 3
    )
  })
  if (bar) found('tab-bar', bar)
  const inBar = (el: Element) => !!bar && bar.contains(el)
  const h1 = all.find((el) => el.matches('h1'))
  if (h1) found('header', h1)
  for (const el of all) {
    if (inBar(el) || !el.matches('button, a, [role=button]')) continue
    if (el.parentElement?.closest('button, a')) continue
    const r = box(el)
    const text = (el.textContent ?? '').trim()
    const hasIcon = !!el.querySelector('svg, i, [class*="material-symbols"]')
    const radius = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius)
    const textless = !firstText(el)
    if (ember(el) && text && r.width > r.height * 1.5 && r.height >= 36) found('button:primary:md', el)
    // Header actions: icon-only buttons near the top (stars and steppers further down are other things).
    else if (
      textless &&
      hasIcon &&
      r.width >= 32 &&
      r.width <= 56 &&
      Math.abs(r.width - r.height) < 4 &&
      !ember(el) &&
      r.top + window.scrollY < 140
    )
      found('icon-button', el)
    else if (!textless && radius >= r.height / 2 - 1 && r.height >= 26 && r.height <= 40 && text.length <= 24)
      found('chip', el)
  }
  for (const el of all) {
    if (inBar(el) || el.closest('button, a')) continue
    const t = ownText(el)
    const c = getComputedStyle(el)
    // Caps labels: uppercased by CSS or typed in capitals, without digits ("RPE 8" is a value, not a label).
    if (
      t.length >= 3 &&
      !/\d/.test(t) &&
      Number.parseFloat(c.fontSize) <= 13 &&
      (c.textTransform === 'uppercase' || (t === t.toUpperCase() && /[A-Z]{4}/.test(t.replace(/\s/g, '')))) &&
      el.matches('h2, h3, h4, p, span, div, label')
    )
      found('section', el)
  }
  return { components, handBuilt }
}

/** Components whose look follows their content (they are generated, so the rest is guaranteed). */
const CONTENT_SHAPED = new Set([
  'card-header',
  'stat',
  'row',
  'chip-row',
  'set-row',
  'search',
  'segmented',
  'bar',
])

export function familyOf(path: string): string {
  if (path.startsWith(`${config.stitchDir}/`)) return config.stitchDir
  return config.archiveDirs.find((d) => path.startsWith(`${d}/`)) ?? 'screens'
}

const p = config.prefix
const NAMES: Record<string, [string, string]> = {
  'tab-bar': ['Tab bar', `${p}-tab-bar`],
  header: ['Screen header', `${p}-header`],
  section: ['Section label', `${p}-section`],
  chip: ['Chip', `${p}-chip`],
  'icon-button': ['Icon button', `${p}-icon-button`],
  'button:primary:md': ['Primary button', `${p}-button`],
}
export const nameOf = (kind: string) => NAMES[kind]?.[0] ?? kind.replace(/:/g, ' ')
const key = (s: Sig) => JSON.stringify(s.fields)

/** Issues for the screens in `paths`, comparing with every screen whose components are known. */
export function consistencyIssues(
  known: Record<string, Components>,
  paths: string[],
): Record<string, Issue[]> {
  const out: Record<string, Issue[]> = {}
  const families = new Map<string, string[]>()
  const catalogs = Object.keys(known).filter((p) => p.startsWith(`${config.catalogDir}/`))
  for (const p of Object.keys(known)) families.set(familyOf(p), [...(families.get(familyOf(p)) ?? []), p])
  for (const path of paths) {
    const issues: Issue[] = []
    out[path] = issues
    const peers = (families.get(familyOf(path)) ?? []).filter((p) => p !== path)
    for (const [kind, sigs] of Object.entries(known[path] ?? {})) {
      if (sigs.length > 1 && !CONTENT_SHAPED.has(kind))
        issues.push({
          severity: 'warning',
          type: 'consistency',
          message: `${sigs.length} different versions of the ${nameOf(kind).toLowerCase()} on this screen`,
          selector: sigs[1]!.selector,
          text: sigs[1]!.text,
        })
      // The component catalog is the reference for every screen that is not an archived experiment.
      const reference =
        familyOf(path) === config.stitchDir || familyOf(path) === 'screens'
          ? catalogs.flatMap((c) => known[c]?.[kind] ?? [])
          : []
      if (catalogs.includes(path)) continue
      if (reference.length) {
        const mine = sigs[0]!
        if (reference.some((r) => key(r) === key(mine))) continue
        const ref = reference[0]!
        const diffs = Object.keys({ ...mine.fields, ...ref.fields })
          .filter((f) => mine.fields[f] !== ref.fields[f])
          .map((f) => `${f} ${mine.fields[f] ?? '–'} (catalog ${ref.fields[f] ?? '–'})`)
        issues.push({
          severity: 'warning',
          type: 'consistency',
          message: `${nameOf(kind)} differs from the component catalog: ${diffs.join('; ')}`,
          selector: mine.selector,
          text: mine.text,
        })
        continue
      }
      // The majority version among the other screens of the family.
      const votes = new Map<string, { n: number; sig: Sig }>()
      for (const p of peers) {
        const first = known[p]?.[kind]?.[0]
        if (!first) continue
        const v = votes.get(key(first)) ?? { n: 0, sig: first }
        v.n++
        votes.set(key(first), v)
      }
      const ranked = [...votes.values()].sort((a, b) => b.n - a.n)
      const top = ranked[0]
      const mine = sigs[0]!
      if (!top) continue
      // No majority: report when this screen matches none of its peers either.
      if (top.n < 2 || ranked[1]?.n === top.n) {
        if (!votes.has(key(mine)) && peers.filter((p) => known[p]?.[kind]).length >= 2)
          issues.push({
            severity: 'warning',
            type: 'consistency',
            message: `${nameOf(kind)} matches none of the other ${ranked.reduce((n, v) => n + v.n, 0)} screens (${ranked.length + 1} different versions in this family)`,
            selector: mine.selector,
            text: mine.text,
          })
        continue
      }
      if (key(mine) === key(top.sig)) continue
      const diffs = Object.keys({ ...mine.fields, ...top.sig.fields })
        .filter((f) => mine.fields[f] !== top.sig.fields[f])
        .map((f) => `${f} ${mine.fields[f] ?? '–'} (others ${top.sig.fields[f] ?? '–'})`)
      issues.push({
        severity: 'warning',
        type: 'consistency',
        message: `${nameOf(kind)} differs from ${top.n} other screens: ${diffs.join('; ')}`,
        selector: mine.selector,
        text: mine.text,
      })
    }
  }
  return out
}

/** Lab screens build catalog components with the components, not by hand. */
export function reuseIssues(path: string, page: PageComponents): Issue[] {
  if (familyOf(path) !== 'screens') return []
  return page.handBuilt.slice(0, 10).map((h) => ({
    severity: 'warning' as const,
    type: 'reuse',
    message: `${nameOf(h.kind)} built by hand; use <${NAMES[h.kind]?.[1] ?? 'the catalog component'}> (see the component catalog, ${config.catalogDir})`,
    selector: h.selector,
    text: h.text,
  }))
}
