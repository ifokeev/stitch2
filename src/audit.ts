/**
 * The layout audit, shared by check (the design screens) and compare (the live app), and exported as
 * stitch2/audit for projects' own tests. Runs inside the page.
 */
import type { Issue } from './typecheck.ts'

/** Layout errors that mean the same bug wherever they appear; compare reports these for the app too. */
export const LAYOUT_ERRORS = ['overflow', 'fixed-overlap', 'control-overlap', 'text-overlap']

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
    // A control whose text sits in two or more elements (a list row's title and its meta line) is a composite
    // control, not a label: its lines are laid out on purpose.
    const holders = new Set<Element>()
    const textWalker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = textWalker.nextNode(); n; n = textWalker.nextNode())
      if (n.textContent!.trim() && n.parentElement) holders.add(n.parentElement)
    if (holders.size > 1) continue
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
  // Behind an open modal the page is inert and covered, so only the modal's own bars count.
  // An open modal: the element may be 0px itself when everything in it is fixed (Headless UI's Dialog).
  const modal = [...document.querySelectorAll('[aria-modal="true"]')].find((m) => {
    const cs = getComputedStyle(m)
    return cs.display !== 'none' && cs.visibility !== 'hidden' && [m, ...m.querySelectorAll('*')].some(shown)
  })
  const outer = bars.filter((b) => !bars.some((o) => o !== b && o.contains(b)) && (!modal || modal.contains(b)))
  const content = all.filter(
    (el) =>
      !outer.some((b) => b.contains(el)) &&
      (!modal || modal.contains(el)) &&
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
            `Hidden under the fixed ${edge} bar (“${text(bar).slice(0, 30) || bar.tagName.toLowerCase()}”) when scrolled to the ${edge} (add padding)`,
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

  // 3c. A fixed bar shows all of itself: a row of it pushed past the bottom (or top) of the screen is unreachable.
  for (const bar of fixedBars)
    for (const e of [bar, ...bar.querySelectorAll('*')]) {
      if (!shown(e) || inSvg(e) || !(ownText(e) || e.matches('svg, img, button, a, input'))) continue
      const r = e.getBoundingClientRect()
      if (r.bottom > window.innerHeight + 1 || r.top < -1) {
        push('error', 'overflow', e, 'Part of a fixed bar is cut off by the screen edge: it lays out on more rows than the bar shows')
        break
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

  // 4b. Controls never overlap one another (a button squeezed over its neighbour). Controls inside one another
  // and invisible overlays (a native picker laid over a row) are fine; fixed and sticky layers (a docked timer,
  // a sticky Save bar floating over a list) are compared apart from the scrolling page.
  const layer = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement)
      if (['fixed', 'sticky'].includes(getComputedStyle(e).position)) return e
    return null
  }
  // The part of a control its scrolling or clipping ancestors show: a link scrolled out of a nav strip is not drawn
  // where its box would be.
  const visibleBox = (el: Element) => {
    const r = el.getBoundingClientRect()
    let { left, top, right, bottom } = r
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
      const c = e.getBoundingClientRect()
      if (cs.overflowX !== 'visible') {
        left = Math.max(left, c.left)
        right = Math.min(right, c.right)
      }
      if (cs.overflowY !== 'visible') {
        top = Math.max(top, c.top)
        bottom = Math.min(bottom, c.bottom)
      }
    }
    return { left, top, right, bottom }
  }
  // Behind an open modal (found above) only the modal's own controls count.
  const solid = interactive.filter((el) => opacity(el) > 0.05 && (!modal || modal.contains(el)))
  for (const [i, a] of solid.entries())
    for (const b of solid.slice(i + 1)) {
      if (a.contains(b) || b.contains(a) || layer(a) !== layer(b)) continue
      const r = visibleBox(a)
      const q = visibleBox(b)
      if (Math.min(r.right, q.right) - Math.max(r.left, q.left) > 2 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 2)
        push('error', 'control-overlap', b, `Overlaps another control (“${text(a).slice(0, 30) || a.getAttribute('aria-label') || a.tagName.toLowerCase()}”): give them room`)
    }

  // 4c. Text never collides with other text: labels of two controls overlapping (a long translation spilling into
  // its neighbour in a tab bar) are errors; labels of two controls closer than 4px are warnings.
  const owner = (el: Element) =>
    el.closest('button, a, label, [role=tab], [role=button], [role=switch], [role=checkbox]') ?? el
  const runs: { el: Element; own: Element; r: DOMRect }[] = []
  {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      if (!el || !n.textContent!.trim() || !shown(el) || inSvg(el) || opacity(el) < 0.5) continue
      if (modal && !modal.contains(el)) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      // Only what shows: text cut off by a clipping parent (an ellipsis) still measures full width.
      const clips = [] as DOMRect[]
      for (let p: Element | null = el; p && p !== document.body; p = p.parentElement)
        if (getComputedStyle(p).overflowX !== 'visible') clips.push(p.getBoundingClientRect())
      for (const raw of range.getClientRects()) {
        let [l, t, r, b] = [raw.left, raw.top, raw.right, raw.bottom]
        for (const c of clips) [l, t, r, b] = [Math.max(l, c.left), Math.max(t, c.top), Math.min(r, c.right), Math.min(b, c.bottom)]
        if (r - l > 1 && b - t > 1) runs.push({ el, own: owner(el), r: new DOMRect(l, t, r - l, b - t) })
      }
    }
  }
  const collided = new Set<Element>()
  for (const [i, a] of runs.entries())
    for (const b of runs.slice(i + 1)) {
      if (a.own === b.own || a.own.contains(b.own) || b.own.contains(a.own) || layer(a.el) !== layer(b.el)) continue
      if (collided.has(a.own) || collided.has(b.own)) continue
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
      const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
      // Same row: stacked lines of a tight heading touch at their glyph boxes and are not a collision.
      const sameRow = y > Math.min(a.r.height, b.r.height) * 0.5
      if (x > 1 && sameRow) {
        collided.add(b.own)
        push('error', 'text-overlap', b.el, 'Text runs into “' + text(a.el).slice(0, 30) + '”: shorten it or give it room')
      } else if (sameRow && x > -4 && a.own !== a.el && b.own !== b.el) {
        collided.add(b.own)
        push('warning', 'text-crowded', b.el, 'Touches “' + text(a.el).slice(0, 30) + '” with no gap: a longer word will collide')
      }
    }

  // 4c'. Labels cut short with an ellipsis: fine for a long exercise name in a row, a translation problem in a tab,
  // a button or a short label. Reported as warnings, for the eye to judge.
  for (const el of all) {
    if (!ownText(el) || getComputedStyle(el).textOverflow !== 'ellipsis') continue
    const h = el as HTMLElement
    if (h.scrollWidth > h.clientWidth + 1) push('warning', 'truncated', el, 'Cut short with an ellipsis (' + h.scrollWidth + 'px of text in ' + h.clientWidth + 'px)')
  }

  // 4d. Nothing sticks out sideways of the card or bar that holds it (a button pushed past its card's edge by a
  // long label), even while still on screen. Clipping and scrolling containers end the search: what they hide
  // is deliberate.
  const paints = (el: Element) => {
    const cs = getComputedStyle(el)
    return !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || Number.parseFloat(cs.borderLeftWidth) > 0
  }
  const outside = new Set<Element>()
  for (const el of all) {
    if (overflowing.has(el) || outside.has(el.parentElement!)) continue
    if (['absolute', 'fixed'].includes(getComputedStyle(el).position)) continue
    let box: Element | null = null
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') break
      if (paints(p)) {
        box = p
        break
      }
    }
    if (!box) continue
    const r = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    const out = Math.max(r.right - b.right, b.left - r.left)
    if (out > 2) {
      outside.add(el)
      push('error', 'overflow', el, 'Sticks out of its container by ' + Math.round(out) + 'px')
    }
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

  // 6. Google's guidelines (Material 3, Android's app quality guidelines, web.dev, Lighthouse). Warnings: each names
  // the rule it comes from, so a screen can break one on purpose (see skills/stitch2/references/google.md).
  const textRects = (el: Element) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1)
  }
  const scrollsSideways = (el: Element) => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const ox = getComputedStyle(e).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
    return false
  }
  const margin = W < 600 ? 16 : 24
  for (const el of all) {
    if (!ownText(el) || opacity(el) < 0.1) continue
    const cs = getComputedStyle(el)
    const size = parseFloat(cs.fontSize)
    // 6a. Material's smallest type level is 11 (label small); body text starts at 12, which Lighthouse asks of
    // most text on a page.
    if (size < 11)
      push('warning', 'text-small', el, 'Text at ' + size + "px: Material's smallest level is 11px, and body text starts at 12px")
    const rects = textRects(el)
    if (!rects.length) continue
    // 6b. Margins: Material keeps content 16dp from the edge of a compact window, 24dp from medium ones up.
    // Navigation bars and tab strips spread their items across the full width; the margin is for content.
    if (!scrollsSideways(el) && !el.closest('nav, [role=navigation], [role=tablist]')) {
      const left = Math.min(...rects.map((r) => r.left))
      const right = Math.max(...rects.map((r) => r.right))
      const gap = Math.min(left, W - right)
      if (gap >= 0 && gap < margin - 0.5)
        push('warning', 'edge-margin', el, 'Text ' + Math.round(gap) + "px from the screen edge (Material's margin is " + margin + 'px at this width)')
    }
    // 6c. Line length: 45–75 characters a line, in every language (Android's app quality guidelines, web.dev).
    if (el.querySelector('p, div, li, ul, ol, section, article, br, h1, h2, h3, h4')) continue
    // Measured word by word: each word's line, then the longest full line (the last one may be short).
    if (rects.length < 2) continue
    const lineChars: { top: number; n: number }[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let t = walker.nextNode(); t; t = walker.nextNode())
      for (const m of t.textContent!.matchAll(/\S+\s*/g)) {
        const range = document.createRange()
        range.setStart(t, m.index!)
        range.setEnd(t, m.index! + m[0].trimEnd().length)
        const top = range.getBoundingClientRect().top
        const line = lineChars.find((l) => Math.abs(l.top - top) < size * 0.6)
        if (line) line.n += m[0].replace(/\s+/g, ' ').length
        else lineChars.push({ top, n: m[0].replace(/\s+/g, ' ').length })
      }
    if (lineChars.length < 2) continue
    const longest = Math.max(...lineChars.sort((a, b) => a.top - b.top).slice(0, -1).map((l) => l.n))
    if (longest > 80)
      push('warning', 'measure', el, 'Lines of up to ' + longest + ' characters: keep prose to 45–75 (a max width of about 32em)')
  }

  // 6d. Touch targets: Material and Lighthouse want 48×48; a smaller one fails when the 48px square around its
  // centre covers a quarter of its area of another target (about 8px apart is enough). Touch-sized windows only.
  const named = (el: Element) => text(el) || el.getAttribute('aria-label') || el.tagName.toLowerCase()
  // Compared like overlaps (4b): behind an open modal only its own controls, and within one layer.
  if (W < 600)
    for (const el of solid) {
      if (solid.some((o) => o !== el && o.contains(el)) || (el.matches('a') && el.closest('p'))) continue
      const r = el.getBoundingClientRect()
      if (r.width >= 48 && r.height >= 48) continue
      if (out.some((i) => i.type === 'tap-target' && i.selector === sel(el))) continue
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const hit = solid.find((o) => {
        if (o === el || o.contains(el) || el.contains(o) || layer(o) !== layer(el)) return false
        const q = o.getBoundingClientRect()
        const ox = Math.max(0, Math.min(cx + 24, q.right) - Math.max(cx - 24, q.left))
        const oy = Math.max(0, Math.min(cy + 24, q.bottom) - Math.max(cy - 24, q.top))
        return ox * oy > 48
      })
      if (hit)
        push('warning', 'tap-spacing', el, Math.round(r.width) + '×' + Math.round(r.height) + 'px and close to “' + named(hit).slice(0, 24) + '”: make it 48px or leave about 8px around it (Material, Lighthouse)')
    }

  // 6e. Forms (web.dev): a placeholder is a hint, not a label; it disappears as soon as someone types.
  const visibleText = (n: Element | null) => !!n && shown(n) && !!(n.textContent ?? '').trim()
  for (const el of all) {
    if (!el.matches('input, textarea')) continue
    if (el.matches('[type=hidden], [type=checkbox], [type=radio], [type=submit], [type=button], [type=range], [type=search], [role=searchbox]')) continue
    if (el.closest('[role=search], search')) continue
    const f = el as HTMLInputElement
    if (!f.placeholder) continue
    const labelled =
      [...(f.labels ?? [])].some(visibleText) ||
      (f.getAttribute('aria-labelledby') ?? '').split(/\s+/).some((id) => visibleText(document.getElementById(id)))
    if (!labelled)
      push('warning', 'placeholder-label', el, 'Its placeholder is its only label, and it disappears while typing: add a visible label (web.dev)')
  }

  // 6f. Every control has a name (Android's content descriptions, WCAG 4.1.2): an icon-only button needs a label.
  for (const el of interactive) {
    if (el.matches('input, select, textarea')) continue
    const name =
      (el.textContent ?? '').trim() ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      [...el.querySelectorAll('img[alt], svg title')].map((i) => i.getAttribute('alt') ?? i.textContent).join('').trim() ||
      (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join('').trim()
    if (!name) push('warning', 'unnamed-control', el, 'An icon-only control with no name: screen readers announce nothing (add aria-label)')
  }

  // 6g. Material's navigation bar holds three to five destinations; more belong in a rail, a drawer or a page.
  for (const el of all) {
    if (!['fixed', 'sticky'].includes(getComputedStyle(el).position)) continue
    const r = el.getBoundingClientRect()
    if (r.bottom < innerHeight - 2 || r.width < W * 0.8) continue
    if (!el.matches('nav, [role=navigation], [role=tablist]') && !el.querySelector('nav, [role=navigation], [role=tablist]')) continue
    const items = [...el.querySelectorAll('a[href], button, [role=tab]')].filter(
      (i) => shown(i) && !i.parentElement?.closest('a[href], button, [role=tab]'),
    )
    if (items.length > 5)
      push('warning', 'nav-destinations', el, items.length + " destinations in the bottom navigation: Material's navigation bar holds 3–5")
  }

  // 6h. Keyboard focus is visible (Material's focus state, web.dev, WCAG 2.4.7): focusing a control changes how
  // it or its frame looks. Transitions are paused so a ring that fades in still counts.
  const still = document.createElement('style')
  still.textContent = '*, *::before, *::after { transition: none !important; animation: none !important }'
  document.head.append(still)
  const look = (e: Element | null) => {
    if (!e) return ''
    const c = getComputedStyle(e)
    return [c.outlineStyle === 'none' ? '' : c.outlineStyle + c.outlineWidth + c.outlineColor, c.boxShadow, c.backgroundColor, c.borderColor, c.color, c.textDecorationLine].join('|')
  }
  const frameOf = (e: HTMLElement) => [e, e.parentElement, e.parentElement?.parentElement ?? null].map(look).join('#')
  const before = document.activeElement as HTMLElement | null
  for (const el of interactive) {
    const h = el as HTMLElement
    if ((h as HTMLButtonElement).disabled || opacity(h) < 0.05) continue
    const was = frameOf(h)
    h.focus({ preventScroll: true, focusVisible: true } as FocusOptions)
    if (document.activeElement !== h) continue
    const now = frameOf(h)
    h.blur()
    if (was === now) push('warning', 'focus-visible', el, 'No visible focus: someone using a keyboard cannot see where they are (add a :focus-visible ring)')
  }
  before?.focus?.({ preventScroll: true })
  still.remove()

  return out.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === 'error' ? -1 : 1))
}
