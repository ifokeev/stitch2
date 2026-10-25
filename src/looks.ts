/**
 * Text as a page draws it, for stitch2 look: every element's own words with the font, size, weight, spacing, line
 * height, colour, case, alignment and decoration they are drawn in, and the pairing of two pages' texts by their words.
 */

/** One piece of text and how it is drawn. */
export interface Text {
  text: string
  /** The first font family only: the fallbacks after it differ between a page and a component for good reason. */
  family: string
  size: string
  weight: string
  style: string
  spacing: string
  leading: string
  colour: string
  transform: string
  align: string
  decoration: string
  /** The shared component it is in (its data-<prefix> value), or empty: the same words in two roles are two texts. */
  inside: string
  /** A short description of the element, for the report: tag and classes. */
  at: string
}

/** Runs in the page: every element's own text, as drawn. Self-contained: Playwright sends this function's source. */
export function texts(prefix: string): Text[] {
  const out: Text[] = []
  const marker = '[data-' + prefix + ']'
  const range = document.createRange()
  // Colours come back in the form they were written in (rgb, color(srgb …), oklch…): the canvas turns each into rgba.
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const paint = canvas.getContext('2d', { willReadFrequently: true })!
  const rgba = (c: string) => {
    paint.clearRect(0, 0, 1, 1)
    paint.fillStyle = '#000'
    paint.fillStyle = c
    paint.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data
    return `rgba(${r}, ${g}, ${b}, ${Math.round(((a ?? 255) / 255) * 100) / 100})`
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('script, style, noscript, template, option')) continue
    let own = ''
    for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) own += `${n.textContent ?? ''} `
    const text = own.replace(/\s+/g, ' ').trim()
    // A number or a symbol on its own (93.1%, $12, 3/4) is data: the same figure can stand in another place on the other page.
    if (text.length < 2 || !/\p{L}/u.test(text)) continue
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    const cs = getComputedStyle(el)
    // Alignment shows only where text runs over more than one line; on a single line, where it sits is geometry's.
    let [top, bottom] = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
    for (const n of el.childNodes) {
      if (n.nodeType !== Node.TEXT_NODE || !(n.textContent ?? '').trim()) continue
      range.selectNodeContents(n)
      const q = range.getBoundingClientRect()
      top = Math.min(top, q.top)
      bottom = Math.max(bottom, q.bottom)
    }
    const line = Number.parseFloat(cs.lineHeight) || Number.parseFloat(cs.fontSize) * 1.3
    const align = bottom - top > line * 1.5 ? ({ left: 'start', right: 'end' } as Record<string, string>)[cs.textAlign] ?? cs.textAlign : ''
    const classes = String(el.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 4).join('.')
    out.push({
      text: text.slice(0, 60),
      family: cs.fontFamily.split(',')[0]!.replace(/["']/g, '').trim(),
      size: cs.fontSize,
      weight: cs.fontWeight,
      style: cs.fontStyle,
      spacing: cs.letterSpacing,
      leading: cs.lineHeight,
      colour: rgba(cs.color),
      transform: cs.textTransform,
      align,
      decoration: cs.textDecorationLine,
      inside: el.closest(marker)?.getAttribute('data-' + prefix) ?? '',
      at: el.tagName.toLowerCase() + (classes ? `.${classes}` : ''),
    })
  }
  return out
}

const PROPS: [keyof Text, string][] = [
  ['family', 'font'],
  ['size', 'size'],
  ['weight', 'weight'],
  ['style', 'font style'],
  ['spacing', 'letter spacing'],
  ['leading', 'line height'],
  ['colour', 'colour'],
  ['transform', 'case'],
  ['align', 'alignment'],
  ['decoration', 'decoration'],
]

const px = (v: string) => (v === 'normal' ? 0 : Number.parseFloat(v))
const channels = (v: string) => (v.match(/[\d.]+/g) ?? []).map(Number)
/** Whether two computed values are the same drawing: lengths within a hair, "normal" spacing as 0px. */
function same(prop: keyof Text, a: string, b: string): boolean {
  if (a === b) return true
  // Alignment is read only where the text runs over several lines; a text that wraps on one page and not on the other has none to compare.
  if (prop === 'align' && (!a || !b)) return true
  if (prop === 'colour') {
    const [x, y] = [channels(a), channels(b)]
    return x.length === 4 && y.length === 4 && x.every((v, i) => Math.abs(v - y[i]!) <= (i === 3 ? 0.02 : 1))
  }
  if (prop === 'size' || prop === 'spacing') return Math.abs(px(a) - px(b)) < 0.06
  if (prop === 'leading') return a !== 'normal' && b !== 'normal' && Math.abs(px(a) - px(b)) < 0.6
  return false
}

export interface Difference {
  /** What differs, for every property that does: "size 14px in the design, 16px in the app". */
  what: string
  /** How many texts differ in exactly this way. */
  count: number
  /** Some of them. */
  texts: string[]
  /** The element in the app (tag and classes) of the first one, to find it in the source. */
  at: string
}

interface Looked {
  differences: Difference[]
  matched: number
  onlyDesign: string[]
  onlyApp: string[]
}

/** Pairs the texts of the two pages by their words and lists how the pairs are drawn differently. */
export function lookAt(design: Text[], app: Text[]): Looked {
  const byText = new Map<string, Text[]>()
  const key = (t: Text) => t.inside + '|' + t.text
  for (const t of design) byText.set(key(t), [...(byText.get(key(t)) ?? []), t])
  const used = new Map<string, number>()
  const groups = new Map<string, Difference>()
  const onlyApp: string[] = []
  let matched = 0
  for (const a of app) {
    const n = used.get(key(a)) ?? 0
    const d = byText.get(key(a))?.[n]
    if (!d) {
      onlyApp.push(a.text)
      continue
    }
    used.set(key(a), n + 1)
    matched++
    const what = PROPS.filter(([k]) => !same(k, d[k], a[k]))
      .map(([k, label]) => `${label} ${d[k]} in the design, ${a[k]} in the app`)
      .join('; ')
    if (!what) continue
    const g = groups.get(what) ?? { what, count: 0, texts: [], at: a.at }
    g.count++
    if (g.texts.length < 4) g.texts.push(a.text)
    groups.set(what, g)
  }
  const onlyDesign: string[] = []
  for (const [k, list] of byText) for (let i = used.get(k) ?? 0; i < list.length; i++) onlyDesign.push(list[i]!.text)
  return { differences: [...groups.values()].sort((x, y) => y.count - x.count), matched, onlyDesign, onlyApp }
}
