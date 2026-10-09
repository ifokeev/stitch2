/**
 * The layout audit, shared by check (the design screens) and compare (the live app). Runs inside the page.
 */
import type { Issue } from './typecheck.ts'

/** Layout errors that mean the same bug wherever they appear; compare reports these for the app too. */
export const LAYOUT_ERRORS = ['overflow', 'fixed-overlap', 'control-overlap']

/** Runs inside the page. Plain JS on purpose: Playwright sends its source to the browser. */
export async function audit(opts: { comfortable: number }): Promise<Issue[]> {
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
  // 3b. Fixed bars never overlap one another, including what sticks out of them (a raised tab-bar button
  // reaching into a docked timer). Compares the painted parts: backgrounds, borders, text, icons, controls.
  const painted = (el: Element) => {
    const cs = getComputedStyle(el)
    return (
      ownText(el) ||
      el.matches('svg, img, button, input') ||
      !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) ||
      Number.parseFloat(cs.borderTopWidth) > 0
    )
  }
  const fixedBars = outer.filter(
    (b) => getComputedStyle(b).position === 'fixed' && b.getBoundingClientRect().height < window.innerHeight * 0.8,
  )
  const parts = (bar: Element) =>
    [bar, ...bar.querySelectorAll('*')].filter((e) => shown(e) && !inSvg(e) && painted(e)).map((e) => e.getBoundingClientRect())
  for (const [i, a] of fixedBars.entries())
    for (const b of fixedBars.slice(i + 1)) {
      const hit = parts(a).some((r) =>
        parts(b).some(
          (q) => Math.min(r.right, q.right) - Math.max(r.left, q.left) > 2 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 2,
        ),
      )
      if (hit) push('error', 'fixed-overlap', b, `Overlaps another fixed bar (“${text(a).slice(0, 30)}”): move one clear of the other`)
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

  // 4b. Controls never overlap one another (a button squeezed over its neighbour). Controls inside one another
  // and invisible overlays (a native picker laid over a row) are fine; fixed and sticky layers (a docked timer,
  // a sticky Save bar floating over a list) are compared apart from the scrolling page.
  const layer = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement)
      if (['fixed', 'sticky'].includes(getComputedStyle(e).position)) return e
    return null
  }
  // Behind an open modal the page is inert and the modal covers it, so only the modal's own controls count.
  const modal = [...document.querySelectorAll('[aria-modal="true"]')].find(shown)
  const solid = interactive.filter((el) => opacity(el) > 0.05 && (!modal || modal.contains(el)))
  for (const [i, a] of solid.entries())
    for (const b of solid.slice(i + 1)) {
      if (a.contains(b) || b.contains(a) || layer(a) !== layer(b)) continue
      const r = a.getBoundingClientRect()
      const q = b.getBoundingClientRect()
      if (Math.min(r.right, q.right) - Math.max(r.left, q.left) > 2 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 2)
        push('error', 'control-overlap', b, `Overlaps another control (“${text(a).slice(0, 30) || a.getAttribute('aria-label') || a.tagName.toLowerCase()}”): give them room`)
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
