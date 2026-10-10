/**
 * Typography checks shared by check and type: collects every rendered text style in a page and compares it
 * with DESIGN.md's type levels.
 */
import type { Level } from './design-md.ts'

export interface Issue {
  severity: 'error' | 'warning'
  type: string
  message: string
  selector: string
  text: string
  /** Set when the issue depends on the theme (contrast): the data-theme it was found in. */
  theme?: string
  /** Set when the issue shows only in another language: the locale it was found in. */
  locale?: string
}

export interface TextItem {
  selector: string
  text: string
  family: string
  mono: boolean
  size: number
  weight: number
  /** px */
  lineHeight: number
  /** px */
  tracking: number
  color: string
  upper: boolean
  numeric: boolean
  lines: number
}

/** Runs in the page. Plain JS on purpose: Playwright sends its source to the browser. */
export function collectText(): TextItem[] {
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
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  const out: TextItem[] = []
  for (const el of document.body.querySelectorAll('*')) {
    const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent!.trim())
    if (!nodes.length || el.closest('script,style,svg,[aria-hidden="true"]')) continue
    const cs = getComputedStyle(el)
    // Icon fonts (Material Symbols) render ligature words as glyphs: not text.
    if (/material|symbols|icons/i.test(cs.fontFamily) || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    let opacity = 1
    for (let e: Element | null = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity)
    if (opacity < 0.05) continue
    const own = nodes.map((n) => n.textContent!.trim()).join(' ')
    const size = Number.parseFloat(cs.fontSize)
    const lineHeight = cs.lineHeight === 'normal' ? size * 1.2 : Number.parseFloat(cs.lineHeight)
    // Lines: line boxes whose middles are more than half a line apart.
    const mids: number[] = []
    for (const n of nodes) {
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const q of range.getClientRects()) if (q.width > 1) mids.push(q.top + q.height / 2)
    }
    mids.sort((a, b) => a - b)
    const lines = mids.filter((m, i) => i === 0 || m - mids[i - 1]! > lineHeight / 2).length
    const m = cs.color.match(/[\d.]+/g)!.map(Number)
    const alpha = (m[3] ?? 1) * opacity
    out.push({
      selector: sel(el),
      text: own.slice(0, 40),
      family: cs.fontFamily.split(',')[0]!.replaceAll(/["']/g, '').trim(),
      mono: /mono/i.test(cs.fontFamily.split(',')[0]!),
      size,
      weight: Number(cs.fontWeight),
      lineHeight,
      tracking: cs.letterSpacing === 'normal' ? 0 : Number.parseFloat(cs.letterSpacing),
      color: `#${hex(m[0]!)}${hex(m[1]!)}${hex(m[2]!)}${alpha < 0.99 ? ` ${Math.round(alpha * 100)}%` : ''}`,
      // Set in capitals: uppercased by CSS, or typed in capitals (6+ letters, so "RPE" and "PR" don't count).
      upper:
        cs.textTransform === 'uppercase' ||
        (own === own.toUpperCase() && own.replace(/[^A-Z]/g, '').length >= 6),
      numeric: /^[\d\s.,:×x+\-−–/%]+[a-z]{0,4}$/i.test(own) && /\d/.test(own),
      lines,
    })
  }
  return out
}

/** The type level a rendered style matches, if any. Line height only matters for text that can wrap. */
export function matchLevel(levels: Level[], t: TextItem): Level | undefined {
  return levels.find(
    (l) =>
      l.mono === t.mono &&
      Math.abs(l.size - t.size) < 0.5 &&
      l.weight === t.weight &&
      Math.abs(l.tracking - t.tracking) <= 0.012 * t.size + 0.05 &&
      Math.abs(l.lineHeight - t.lineHeight) < 1.5,
  )
}

export function nearestLevel(levels: Level[], t: TextItem): Level {
  const score = (l: Level) =>
    Math.abs(l.size - t.size) * 2 + Math.abs(l.weight - t.weight) / 100 + (l.mono === t.mono ? 0 : 3)
  return [...levels].sort((a, b) => score(a) - score(b))[0]!
}

const describe = (t: TextItem) =>
  `${t.mono ? 'mono ' : ''}${t.size}/${Math.round(t.lineHeight)} ${t.weight}${t.tracking ? ` ${(t.tracking / t.size).toFixed(2)}em` : ''}`
const describeLevel = (l: Level) =>
  `${l.name} (${l.mono ? 'mono ' : ''}${l.size}/${l.lineHeight} ${l.weight}${l.tracking ? ` ${(l.tracking / l.size).toFixed(2)}em` : ''})`

/** Typography issues for one screen: off-scale styles, cramped wrapped text, untracked caps, mono decimals. */
export function typeIssues(levels: Level[], items: TextItem[]): Issue[] {
  const out: Issue[] = []
  const seen = new Set<string>()
  const push = (severity: Issue['severity'], type: string, t: TextItem, message: string) => {
    if (out.filter((i) => i.type === type).length >= 10) return
    out.push({ severity, type, message, selector: t.selector, text: t.text })
  }
  for (const t of items) {
    if (levels.length && !matchLevel(levels, t)) {
      const key = describe(t)
      if (!seen.has(key)) {
        seen.add(key)
        push(
          'warning',
          'type-scale',
          t,
          `Off the type scale: ${key}; nearest level ${describeLevel(nearestLevel(levels, t))}`,
        )
      }
    }
    if (t.lines > 1 && t.lineHeight < t.size * 1.15)
      push(
        'error',
        'type-leading',
        t,
        `Wrapped text with cramped line height (${Math.round(t.lineHeight)}px for ${t.size}px type)`,
      )
    if (t.upper && t.text.length > 2 && t.tracking < 0.03 * t.size)
      push('warning', 'type-caps', t, 'Capitals without letter-spacing (use label-caps, +0.06em)')
    if (t.mono && t.size >= 18 && /\d[.,:]\d/.test(t.text))
      push(
        'warning',
        'type-mono-number',
        t,
        'Large number in a monospace font: its point, comma or colon gets a full-width gap; use Geist with tabular figures',
      )
  }
  return out
}
