/**
 * The layout audit, shared by check (the design screens) and compare (the live app), and exported as
 * stitch2/audit for projects' own tests. Runs inside the page.
 */
import type { Issue } from './typecheck.ts'

/** Layout errors that mean the same bug wherever they appear; compare reports these for the app too. */
export const LAYOUT_ERRORS = ['overflow', 'nav-overflow', 'fixed-overlap', 'control-overlap', 'text-overlap']

/** Runs inside the page. Plain JS on purpose: Playwright sends its source to the browser. */
export async function audit(opts: { comfortable: number; durations?: number[]; secondary?: string; columns?: number[] }): Promise<Issue[]> {
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
  const overflowClips = (el: Element, ancestor: Element) => {
    // Overflow does not clip an absolutely/fixed positioned descendant whose containing block lies
    // outside that ancestor. This differs from clip-path and matters for overlays in zero-sized wrappers.
    for (let e: Element | null = el; e && e !== ancestor; e = e.parentElement) {
      const position = getComputedStyle(e).position
      if (position !== 'absolute' && position !== 'fixed') continue
      let block: Element | null = null
      for (let p = e.parentElement; p; p = p.parentElement) {
        const c = getComputedStyle(p)
        if ((position === 'absolute' && c.position !== 'static') || c.transform !== 'none' || c.filter !== 'none' || c.perspective !== 'none' ||
          /paint|layout|strict|content/.test(c.contain) || /transform|filter|perspective/.test(c.willChange)) {
          block = p
          break
        }
      }
      if (!block || !ancestor.contains(block)) return false
    }
    return true
  }
  const shown = (el: Element) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    // A closed <details> shows only its summary (a menu's links until it opens).
    const closed = el.closest('details:not([open])')
    if (closed && !closed.querySelector(':scope > summary')?.contains(el)) return false
    const r = el.getBoundingClientRect()
    // Text kept for screen readers only (Tailwind's sr-only: a 1px box, clipped away) is not drawn.
    if (r.width <= 1 && r.height <= 1 && cs.position === 'absolute') return false
    // Opacity, clipping and content-visibility belong to ancestors too. These nodes can have large boxes
    // outside the page without painting anything there (a tooltip at rest or an accessible file input).
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false
    const topLayer = el.closest(':modal, :popover-open')
    for (let e: Element | null = el; e; e = e.parentElement) {
      const c = getComputedStyle(e)
      if (c.clip === 'rect(0px, 0px, 0px, 0px)' || /^inset\((50|100)%\)$/.test(c.clipPath)) return false
      if (e !== el && (c.overflowX !== 'visible' || c.overflowY !== 'visible')) {
        const q = e.getBoundingClientRect()
        if (((c.overflowX !== 'visible' && q.width <= 0) || (c.overflowY !== 'visible' && q.height <= 0)) && overflowClips(el, e)) return false
      }
      if (e === topLayer) break
    }
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
  type Box = { left: number; top: number; right: number; bottom: number }
  const intersect = (a: Box, b: Box): Box => ({
    left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom),
  })
  const area = (r: Box, minimum = 0) => r.right - r.left > minimum && r.bottom - r.top > minimum
  // Inline controls have one rectangle per line; their bounding rectangle includes empty corners between
  // lines. Compare the fragments the browser draws, clipped on each axis by their scrolling ancestors.
  const visibleRects = (el: Element): Box[] => {
    let rects: Box[] = [...el.getClientRects()]
    const topLayer = el.closest(':modal, :popover-open')
    if (topLayer === el) return rects.filter((r) => area(r))
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const c = getComputedStyle(e)
      if ((c.overflowX !== 'visible' || c.overflowY !== 'visible') && overflowClips(el, e)) {
        const r = e.getBoundingClientRect()
        rects = rects.map((q) => intersect(q, {
          left: c.overflowX === 'visible' ? -Infinity : r.left,
          right: c.overflowX === 'visible' ? Infinity : r.right,
          top: c.overflowY === 'visible' ? -Infinity : r.top,
          bottom: c.overflowY === 'visible' ? Infinity : r.bottom,
        }))
      }
      // Top-layer elements escape their ancestors' overflow, but their own scrolling still clips children.
      if (e === topLayer) break
    }
    return rects.filter((r) => area(r))
  }
  const proseLink = (el: Element) => {
    if (!el.matches('a') || getComputedStyle(el).display !== 'inline' || el.closest('nav, header, [role=navigation], [role=tablist], [role=menu]')) return false
    const context = el.closest('p, li, blockquote, dd, figcaption')
    if (!context) return false
    // WCAG's inline-target exception is for links within a sentence, not a list of standalone links.
    const walker = document.createTreeWalker(context, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      if (n.textContent!.trim() && !n.parentElement?.closest('a, button')) return true
    return false
  }
  const verticalNavigationLink = (el: Element) => {
    if (!el.matches('a') || !el.closest('nav, [role=navigation]')) return false
    const row = el.closest('li')
    const list = row?.parentElement ?? el.parentElement
    if (!list) return false
    const c = getComputedStyle(list)
    // A vertical contents/menu list can contain sentence-length titles. Horizontal bars and tab rows
    // retain their one-line label rule; wrapping them is not a substitute for responsive navigation.
    return (c.display === 'block' && (row ? !getComputedStyle(row).display.startsWith('inline') : getComputedStyle(el).display === 'block')) ||
      (c.display.includes('flex') && c.flexDirection.startsWith('column')) ||
      (c.display.includes('grid') && c.gridTemplateColumns.split(/\s+/).length === 1)
  }
  const contentTextFits = (el: Element) => {
    const c = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const top = r.top + parseFloat(c.borderTopWidth) + parseFloat(c.paddingTop)
    const bottom = r.bottom - parseFloat(c.borderBottomWidth) - parseFloat(c.paddingBottom)
    const left = r.left + parseFloat(c.borderLeftWidth) + parseFloat(c.paddingLeft)
    const right = r.right - parseFloat(c.borderRightWidth) - parseFloat(c.paddingRight)
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let found = false
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent!.trim() || !n.parentElement || !shown(n.parentElement)) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const q of range.getClientRects()) {
        found = true
        if (q.top < top - 1 || q.bottom > bottom + 1 || q.left < left - 1 || q.right > right + 1) return false
      }
    }
    return found
  }
  const disclosureTextFits = (el: Element) => el.matches('button[aria-expanded]:not([aria-haspopup])') &&
    ['left', 'start'].includes(getComputedStyle(el).textAlign) && contentTextFits(el)
  const readableContentControl = (el: Element) => {
    if (el.closest('nav, [role=navigation], [role=menu], [role=tablist], [role=toolbar]')) return false
    const c = getComputedStyle(el)
    // Pretty/balanced wrapping explicitly authors a content title, not a
    // compact action label. It still has to fit without clipping or crowding.
    return ['pretty', 'balance'].includes(c.textWrapStyle) &&
      parseFloat(c.lineHeight) >= parseFloat(c.fontSize) * 1.3 && contentTextFits(el)
  }

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
    // A nested clip (for example a title's ellipsis) must not hide the fact
    // that its whole card belongs to a deliberate horizontal scroller.
    if (visibleRects(el).every((q) => q.right <= 0 || q.left >= W)) continue
    // The nearest clip says how the text is cut; a scroller anywhere above it (a row of pictures, each with its own rounded clip) means the
    // cut is the edge of something that scrolls, and a tile that shows only in part there is how a person sees that it does.
    let clip: string | null = null
    let scrolls = false
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll') {
        scrolls = true
        break
      }
      if (ox !== 'visible') clip ??= ox
    }
    if (scrolls) continue
    if (overflowing.has(el.parentElement!)) {
      overflowing.add(el)
      continue
    }
    overflowing.add(el)
    if (clip) {
      if (ownText(el)) push('warning', 'clipped', el, 'Text is cut off at the screen edge')
    } else push('error', 'overflow', el, `Sticks out past the screen edge (${Math.round(r.right - W)}px)`)
  }

  // 1b. Navigation fits: a nav's links never hide in a sideways scroll or run past its edge (in a longer language
  // they go into a menu instead). Only chip rows scroll sideways.
  for (const el of all) {
    if (!el.matches('nav, [role=navigation]') && !(el.closest('header') && el.querySelector(':scope > a'))) continue
    const ox = getComputedStyle(el).overflowX
    if (ox === 'visible') continue
    const box = el.getBoundingClientRect()
    const cut = [...el.querySelectorAll('a')].filter((a) => {
      if (!shown(a)) return false
      const r = a.getBoundingClientRect()
      // Wholly outside (wrapped away into a menu's overflow) is a choice; partly outside is a cut link.
      const inside = r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1
      const outside = r.right <= box.left || r.left >= box.right || r.bottom <= box.top || r.top >= box.bottom
      return !inside && (!outside || ox === 'auto' || ox === 'scroll')
    })
    if (cut.length)
      push(
        'error',
        'nav-overflow',
        el,
        `Navigation does not fit: ${cut.length} link${cut.length > 1 ? 's' : ''} cut off or scrolled out of view (${cut
          .map(text)
          .slice(0, 3)
          .join(', ')})`,
      )
  }

  // 2. Short labels (buttons, chips, tabs) stay on one line.
  const isLabel = (el: Element) =>
    el.matches('button, a, label, [role=tab], [role=button], [role=switch], th') ||
    /(^|\s)(chip|badge|pill|tag)|rounded-full/.test(String((el as HTMLElement).className ?? ''))
  for (const el of all) {
    if (!isLabel(el) || el.querySelector('p, div, li, ul, br')) continue
    // A tooltip describes its trigger but is not its painted control label,
    // even when hovered. Hidden hints cannot create a wrap or conceal a real
    // wrapped label by pushing its text beyond the short-label length limit.
    const labelNodes: Text[] = []
    const textWalker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = textWalker.nextNode(); n; n = textWalker.nextNode())
      if (n.textContent!.trim() && n.parentElement && shown(n.parentElement) && !n.parentElement.closest('[role=tooltip]'))
        labelNodes.push(n as Text)
    if (!labelNodes.length || labelNodes.map((n) => n.textContent).join(' ').trim().length > 40) continue
    // Prose links flow with their sentence; vertical contents titles and fitted disclosure headings can
    // also wrap. Horizontal navigation, tabs and ordinary button labels retain their one-line rule.
    if (proseLink(el) || verticalNavigationLink(el) || disclosureTextFits(el) || readableContentControl(el)) continue
    // A control whose text sits in two or more elements (a list row's title and its meta line) is a composite
    // control, not a label: its lines are laid out on purpose.
    const holders = new Set(labelNodes.map((n) => n.parentElement))
    if (holders.size > 1) continue
    // A wrap is one text node breaking across lines; an icon above its label is layout, not a wrap.
    for (const n of labelNodes) {
      // A label allowed two lines on purpose (line-clamp-2: a navigation rail's, under its icon) may wrap.
      if ((parseInt(getComputedStyle(n.parentElement!).getPropertyValue('-webkit-line-clamp')) || 0) > 1) continue
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
  // A fixed element inside a transformed (or filtered, or contained) box is placed in that box, not on the
  // screen: a catalog showing a tab bar in place, for one. Only bars pinned to the screen count.
  const pinned = (el: Element) => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none' || /paint|layout|strict|content/.test(cs.contain))
        return false
    }
    return true
  }
  const bars = all.filter((el) => {
    const p = getComputedStyle(el).position
    const r = el.getBoundingClientRect()
    return (p === 'sticky' || (p === 'fixed' && pinned(el))) && r.height <= 240 && r.width >= W * 0.6
  })
  // Behind an open modal the page is inert and covered, so only the modal's own bars count.
  // An open modal: the element may be 0px itself when everything in it is fixed (Headless UI's Dialog).
  const modals = [...document.querySelectorAll('dialog:modal, [aria-modal="true"]')].filter((m) => {
    const cs = getComputedStyle(m)
    return cs.display !== 'none' && cs.visibility !== 'hidden' && [m, ...m.querySelectorAll('*')].some(shown)
  })
  // Native dialogs enter the top layer in opening order, which need not match document order. Hit-testing
  // their centres identifies the active one; focus also covers zero-sized ARIA modal wrappers.
  const modal = modals.find((m) => {
    const r = m.getBoundingClientRect()
    const hit = document.elementFromPoint(Math.max(0, Math.min(W - 1, r.left + r.width / 2)), Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2)))
    return hit?.closest('dialog:modal, [aria-modal="true"]') === m
  }) ?? document.activeElement?.closest('dialog:modal, [aria-modal="true"]') ?? modals.at(-1)
  const outer = bars.filter((b) => !bars.some((o) => o !== b && o.contains(b)) && (!modal || modal.contains(b)))
  const content = all.filter(
    (el) =>
      !outer.some((b) => b.contains(el)) &&
      (!modal || modal.contains(el)) &&
      (ownText(el) || el.matches('button, input, select, textarea, img, svg, canvas, video')) &&
      opacity(el) > 0.5,
  )
  const painted = (el: Element) => {
    const cs = getComputedStyle(el)
    return (
      ownText(el) ||
      el.matches('svg, img, button, input') ||
      !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) ||
      Number.parseFloat(cs.borderTopWidth) > 0
    )
  }
  const paintedParts = (bar: Element) => [bar, ...bar.querySelectorAll('*')].filter((e) => shown(e) && !inSvg(e) && painted(e))
  const barCovers = (bar: Element, el: Element, rect: Box) => {
    // Geometry alone cannot tell which thing is on top: a menu or a modal can overlap a header while
    // painting in front of it. Sample the actual intersection and ask the browser about paint order.
    // Pointer-events:none must not hide a genuinely covering bar from that test.
    const styles = [bar, el].map((e) => ({ e: e as HTMLElement, value: (e as HTMLElement).style.getPropertyValue('pointer-events'), priority: (e as HTMLElement).style.getPropertyPriority('pointer-events') }))
    for (const { e } of styles) e.style.setProperty('pointer-events', 'auto', 'important')
    try {
      for (const fx of [0.1, 0.5, 0.9])
        for (const fy of [0.1, 0.5, 0.9]) {
          const x = rect.left + (rect.right - rect.left) * fx
          const y = rect.top + (rect.bottom - rect.top) * fy
          const hits = document.elementsFromPoint(x, y)
          const first = hits[0]
          if (first && bar.contains(first) && hits.some((hit) => el === hit || el.contains(hit))) return true
        }
      return false
    } finally {
      for (const { e, value, priority } of styles)
        if (value) e.style.setProperty('pointer-events', value, priority)
        else e.style.removeProperty('pointer-events')
    }
  }
  const covered = async (edge: 'top' | 'bottom') => {
    window.scrollTo(0, edge === 'bottom' ? document.documentElement.scrollHeight : 0)
    await frame()
    const H = window.innerHeight
    for (const bar of outer) {
      const b = bar.getBoundingClientRect()
      const atEdge = edge === 'bottom' ? b.bottom >= H - 4 && b.top > H / 2 : b.top <= 4 && b.bottom < H / 2
      if (!atEdge) continue
      const drawn = paintedParts(bar).flatMap((part) => visibleRects(part))
      for (const el of content) {
        if (el.contains(bar)) continue
        const hidden = visibleRects(el).some((r) => drawn.some((q) => {
          const overlap = intersect(intersect(r, q), { left: 0, top: 0, right: W, bottom: H })
          return area(overlap, 4) && barCovers(bar, el, overlap)
        }))
        if (hidden)
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
  const fixedBars = outer.filter(
    (b) => getComputedStyle(b).position === 'fixed' && b.getBoundingClientRect().height < window.innerHeight * 0.8,
  )
  const parts = (bar: Element) => paintedParts(bar).flatMap((part) => visibleRects(part))
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
  // Fixed and sticky layers float over the scrolling page (a running-workout panel over cards): content slides
  // under them while scrolling, so they never crowd in-flow targets. Tap spacing (6d) already compares layers.
  const layerOf = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement)
      if (['fixed', 'sticky'].includes(getComputedStyle(e).position)) return e
    return null
  }
  const tapRect = (el: Element) => {
    if (el instanceof HTMLInputElement && /^(checkbox|radio)$/.test(el.type))
      for (const label of el.labels ?? []) {
        if (!shown(label) || label.control !== el || getComputedStyle(label).pointerEvents === 'none') continue
        const sized = (box: Box) => box.right - box.left >= opts.comfortable && box.bottom - box.top >= opts.comfortable
        let r = visibleRects(label).find(sized)
        // A row at a scrollport edge can be fully revealed even inside an
        // overflow-hidden dialog frame. Prove that by scrolling, measuring the
        // actually exposed area, then restoring every scroll position.
        if (!r) {
          const original = label.getBoundingClientRect()
          const scrolls: { el: Element; left: number; top: number }[] = []
          for (let p = label.parentElement; p; p = p.parentElement) {
            const c = getComputedStyle(p)
            if ((/auto|scroll/.test(c.overflowX) && p.scrollWidth > p.clientWidth) || (/auto|scroll/.test(c.overflowY) && p.scrollHeight > p.clientHeight))
              scrolls.push({ el: p, left: p.scrollLeft, top: p.scrollTop })
          }
          if (scrolls.length && original.width >= opts.comfortable && original.height >= opts.comfortable) {
            const before = { x: scrollX, y: scrollY }
            try {
              label.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
              const revealed = visibleRects(label).find(sized)
              if (revealed) r = { left: original.left, top: original.top, right: original.left + revealed.right - revealed.left, bottom: original.top + revealed.bottom - revealed.top }
            } finally {
              for (const s of scrolls) { s.el.scrollLeft = s.left; s.el.scrollTop = s.top }
              window.scrollTo({ left: before.x, top: before.y, behavior: 'instant' })
            }
          }
        }
        // Associated native labels are part of the hit area, not checkbox artwork.
        if (r) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.right - r.left, height: r.bottom - r.top }
      }
    return el.getBoundingClientRect()
  }
  for (const el of interactive) {
    if (interactive.some((o) => o !== el && o.contains(el))) continue
    if (proseLink(el)) continue
    // Scrolling containers can fully clip an otherwise laid-out control. It
    // has no current hit area to measure; being below the window alone does
    // not clip it, and the control is checked after scrolling it into view.
    if (!visibleRects(el).length) continue
    const r = tapRect(el)
    // A control that fades or slides in measures 43.99999px for a frame: sub-pixel noise of the transform, not a smaller target.
    const min = Math.round(Math.min(r.width, r.height) * 100) / 100
    // WCAG 2.2 spacing exception: a smaller target passes when a 24px circle on it touches no other target.
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const crowded = interactive.some((o) => {
      if (o === el || o.contains(el) || el.contains(o) || layerOf(o) !== layerOf(el)) return false
      const q = tapRect(o)
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
  // layerOf is defined with the tap targets above; fixed and sticky layers are compared apart here too.
  const layer = layerOf
  // The part of a control its scrolling or clipping ancestors show: a link scrolled out of a nav strip is not drawn
  // where its box would be.
  const isEmptyOverlay = (el: Element) => {
    if (!['absolute', 'fixed'].includes(getComputedStyle(el).position) || text(el) || el.querySelector('svg, img, canvas, video, input')) return false
    const c = getComputedStyle(el)
    if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor) || c.backgroundImage !== 'none' || c.boxShadow !== 'none' ||
      [c.borderTopWidth, c.borderRightWidth, c.borderBottomWidth, c.borderLeftWidth].some((v) => parseFloat(v) > 0)) return false
    for (const pseudo of ['::before', '::after']) {
      const p = getComputedStyle(el, pseudo)
      if (p.content !== 'none' && p.content !== 'normal' && p.display !== 'none') return false
    }
    return true
  }
  const emptyOverlay = (el: Element, other: Element) => {
    if (!emptyOverlays.has(el)) return false
    const r = el.getBoundingClientRect(), q = other.getBoundingClientRect()
    // A stretched card/row action underneath its own secondary link is intentional. An empty control
    // merely colliding with a neighbour, or a painted button covering another control, is still an error.
    if (!(r.left <= q.left && r.right >= q.right && r.top <= q.top && r.bottom >= q.bottom && (r.width > q.width + 2 || r.height > q.height + 2))) return false
    // Transparency alone does not prove that this pattern works: an invisible action above the link
    // blocks it. Ask the browser whether the secondary control is actually reachable. Scroll the window
    // only when necessary to hit-test an offscreen row; leave nested scroll positions and final scroll intact.
    const before = { x: scrollX, y: scrollY }
    try {
      if (q.bottom <= 0 || q.top >= innerHeight) window.scrollTo({ top: scrollY + q.top - innerHeight / 2, behavior: 'instant' })
      return visibleRects(other).some((box) => {
        const onScreen = intersect(box, { left: 0, top: 0, right: W, bottom: innerHeight })
        if (!area(onScreen)) return false
        const hit = document.elementFromPoint((onScreen.left + onScreen.right) / 2, (onScreen.top + onScreen.bottom) / 2)
        return !!hit && other.contains(hit)
      })
    } finally {
      if (scrollX !== before.x || scrollY !== before.y) window.scrollTo({ left: before.x, top: before.y, behavior: 'instant' })
    }
  }
  const reservedInputAction = (field: Element, action: Element) => {
    if (!field.matches('input') || !action.matches('button, [role=button]') || !field.parentElement?.contains(action)) return false
    if (!['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes((field as HTMLInputElement).type)) return false
    const r = field.getBoundingClientRect(), q = action.getBoundingClientRect()
    if (q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1) return false
    const c = getComputedStyle(field)
    const left = r.left + parseFloat(c.borderLeftWidth) + parseFloat(c.paddingLeft)
    const right = r.right - parseFloat(c.borderRightWidth) - parseFloat(c.paddingRight)
    // A clear/reveal/list toggle may occupy padding reserved for it, but never the editable text area.
    return q.right <= left + 1 || q.left >= right - 1
  }
  // Behind an open modal (found above) only the modal's own controls count.
  const solid = interactive.filter((el) => opacity(el) > 0.05 && visibleRects(el).length > 0 && (!modal || modal.contains(el)))
  const emptyOverlays = new Set(solid.filter(isEmptyOverlay))
  const controlRects = new Map(solid.map((el) => [el, visibleRects(el)]))
  for (const [i, a] of solid.entries())
    for (const b of solid.slice(i + 1)) {
      if (a.contains(b) || b.contains(a) || layer(a) !== layer(b)) continue
      if (reservedInputAction(a, b) || reservedInputAction(b, a) || emptyOverlay(a, b) || emptyOverlay(b, a)) continue
      if (controlRects.get(a)!.some((r) => controlRects.get(b)!.some((q) => area(intersect(r, q), 2))))
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
    const rects: DOMRect[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent!.trim() || !node.parentElement || !shown(node.parentElement) || opacity(node.parentElement) < 0.1) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      rects.push(...range.getClientRects())
    }
    return rects.filter((r) => r.width > 1 && r.height > 1)
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
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.parentElement || !shown(t.parentElement) || opacity(t.parentElement) < 0.1) continue
      for (const m of t.textContent!.matchAll(/\S+\s*/g)) {
        const range = document.createRange()
        range.setStart(t, m.index!)
        range.setEnd(t, m.index! + m[0].trimEnd().length)
        const top = range.getBoundingClientRect().top
        const line = lineChars.find((l) => Math.abs(l.top - top) < size * 0.6)
        if (line) line.n += m[0].replace(/\s+/g, ' ').length
        else lineChars.push({ top, n: m[0].replace(/\s+/g, ' ').length })
      }
    }
    if (lineChars.length < 2) continue
    const longest = Math.max(...lineChars.sort((a, b) => a.top - b.top).slice(0, -1).map((l) => l.n))
    if (longest > 80)
      push('warning', 'measure', el, 'Lines of up to ' + longest + ' characters: keep prose to 45–75 (a max width of about 32em)')
  }

  // 6e. Text tiers: a sentence to read belongs in the body colour (skills/stitch2/references/typography.md, section 3). A block of reading
  // copy, drawn in the secondary colour, is the usual reason a page reads dull although every contrast ratio passes: the strokes of small
  // text reach only their own colour. A block is reading copy when it holds sixty characters and eight words of its own text at 14px or
  // more (a caption or a field's help text is smaller, and the secondary colour is for it) and sits in the page's content: not in a bar, a
  // table, a menu, a label, a control, a link or a code sample. It needs the secondary colour, which
  // check takes from DESIGN.md's text-muted and passes as a CSS colour the page can resolve (var(--<prefix>-text-muted)).
  if (opts.secondary) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const g = canvas.getContext('2d', { willReadFrequently: true })!
    const rgba = (value: string) => {
      g.clearRect(0, 0, 1, 1)
      g.fillStyle = '#000'
      g.fillStyle = value
      g.fillRect(0, 0, 1, 1)
      const d = g.getImageData(0, 0, 1, 1).data
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255]
    }
    const probe = document.createElement('span')
    probe.style.color = opts.secondary
    document.body.append(probe)
    const want = rgba(getComputedStyle(probe).color)
    probe.remove()
    const quiet = (el: Element) => {
      const have = rgba(getComputedStyle(el).color)
      return Math.abs(have[0]! - want[0]!) <= 2 && Math.abs(have[1]! - want[1]!) <= 2 && Math.abs(have[2]! - want[2]!) <= 2 && Math.abs(have[3]! - want[3]!) <= 0.02
    }
    const apart = 'nav, footer, table, button, summary, label, a, code, pre, figcaption, caption, [role=navigation], [role=tablist], [role=tab], [role=menu], [role=listbox], [role=tooltip], [role=button], [aria-hidden=true]'
    for (const el of all) {
      if (!ownText(el) || opacity(el) < 0.1 || el.closest(apart)) continue
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim()
      if (own.length < 60 || own.split(' ').length < 8 || parseFloat(getComputedStyle(el).fontSize) < 14 || !quiet(el)) continue
      push('warning', 'text-tier', el, 'Reading copy in the secondary colour: a sentence to read takes the body colour, and the secondary one is for hints, captions and counts')
    }
  }

  // 6f. Corner radius: everything that is pressed or typed into shares one radius, so a button beside a field has the same corner
  // (skills/stitch2/references/components.md, Shape). A control is a button, a field, a select, a summary or a role=button with a box
  // (a fill or a line) and a corner that is not square and not a pill. The radius most of them use is the screen's; a control with
  // another one is reported. A control inset in a rounded box (a segment in a switch) takes the box's radius minus the gap, so it is left alone.
  {
    const kinds = 'button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]), select, textarea, summary, [role=button], [role=combobox]'
    const clear = (value: string) => /^(rgba\(0, 0, 0, 0\)|transparent)$/.test(value)
    const boxed: { el: Element; radius: number }[] = []
    for (const el of all) {
      // A button that holds a picture (a thumbnail) takes its shape from the picture, not from the controls around it.
      if (!el.matches(kinds) || el.closest('[aria-hidden=true]') || el.querySelector('img, video, canvas, picture')) continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 24 || rect.height < 24 || rect.height > 80) continue
      const cs = getComputedStyle(el)
      const filled = !clear(cs.backgroundColor) || cs.backgroundImage !== 'none'
      const lined = parseFloat(cs.borderTopWidth) > 0 && !clear(cs.borderTopColor)
      if (!filled && !lined) continue
      const corner = cs.borderTopLeftRadius
      const radius = parseFloat(corner)
      if (corner.includes('%') || !(radius > 0) || radius >= Math.min(rect.width, rect.height) / 2 - 1) continue
      let inset = false
      for (let p = el.parentElement, depth = 0; p && p !== document.body && depth < 2 && !inset; p = p.parentElement, depth++) {
        const c = getComputedStyle(p)
        const drawn = !clear(c.backgroundColor) || parseFloat(c.borderTopWidth) > 0
        inset = drawn && (parseFloat(c.borderTopLeftRadius) || 0) > radius && parseFloat(c.paddingTop) <= 12 && parseFloat(c.paddingLeft) <= 12
      }
      if (!inset) boxed.push({ el, radius: Math.round(radius) })
    }
    const count = new Map<number, number>()
    for (const b of boxed) count.set(b.radius, (count.get(b.radius) ?? 0) + 1)
    if (count.size > 1) {
      const [common] = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]!
      for (const b of boxed)
        if (b.radius !== common)
          push('warning', 'radius-mismatch', b.el, 'Corner radius ' + b.radius + 'px, where ' + count.get(common) + ' of the ' + boxed.length + ' controls here use ' + common + 'px: everything pressed or typed into shares one radius')
    }
  }

  // 6g. Field text: iOS Safari zooms the page into a focused field whose text is under 16px, which moves the layout and can hide the button that
  // submits it. The cure is the size (a locked viewport also stops people who need to zoom), so a field in a touch-sized window needs 16px.
  // A field that cannot take focus (disabled, hidden) never zooms.
  if (W < 768) {
    const fields = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image]), textarea, select'
    for (const el of all) {
      if (!el.matches(fields) || (el as HTMLInputElement).disabled) continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 24 || rect.height < 24) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < 16)
        push('warning', 'field-zoom', el, 'Text of ' + Math.round(size * 10) / 10 + 'px in a field: iOS Safari zooms the page into a focused field under 16px; a field on a phone takes 16px')
    }
  }

  // 6h. A control in a capsule. A capsule that holds controls (the chat composer, the bar over a lightbox) is a container, and a control in it is a
  // circle: the capsule's end is a half circle, and a rounded square inside it meets that curve with its corner (Apple's concentricity, Material's
  // round icon button). So a control with a corner that is neither square nor a circle, in a capsule drawn with a fill or a line, is reported,
  // whether it has a box at rest or only on hover. A control that is itself the capsule (a chip), a picture button and a field with no box of
  // its own are left alone.
  {
    const kinds = 'button, summary, [role=button], a[href], input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]), select, textarea, [role=combobox]'
    const fieldKinds = 'input, select, textarea, [role=combobox]'
    const clear = (value: string) => /^(rgba\(0, 0, 0, 0\)|transparent)$/.test(value)
    for (const el of all) {
      if (!el.matches(kinds) || el.closest('[aria-hidden=true]') || el.querySelector('img, video, canvas, picture')) continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 24 || rect.height < 24 || rect.height > 80) continue
      const cs = getComputedStyle(el)
      const corner = cs.borderTopLeftRadius
      const radius = parseFloat(corner)
      if (corner.includes('%') || !(radius > 0) || radius >= Math.min(rect.width, rect.height) / 2 - 1) continue
      if (el.matches(fieldKinds) && clear(cs.backgroundColor) && !(parseFloat(cs.borderTopWidth) > 0 && !clear(cs.borderTopColor))) continue
      for (let p = el.parentElement, depth = 0; p && p !== document.body && depth < 4; p = p.parentElement, depth++) {
        if (p.matches(kinds)) break
        const c = getComputedStyle(p)
        const box = p.getBoundingClientRect()
        const pill = parseFloat(c.borderTopLeftRadius)
        const drawn = !clear(c.backgroundColor) || (parseFloat(c.borderTopWidth) > 0 && !clear(c.borderTopColor))
        if (drawn && !c.borderTopLeftRadius.includes('%') && box.height >= 32 && box.height <= 96 && pill >= box.height / 2 - 1) {
          push('warning', 'capsule-control', el, 'A corner of ' + Math.round(radius) + 'px in a capsule: a control inside a capsule is a circle (the round icon button), so it follows the curve of the end')
          break
        }
      }
    }
  }

  // 6k. Columns. A page that is not full width sits in one of a few columns that DESIGN.md names (spacing tokens column-narrow, column-wide, …), so a
  // person who goes from one page of a section to the next finds the content on the same vertical lines. A column is a container that a max-width
  // holds (its width is the max-width) and that is wider than 840px; narrower ones are a reading measure and are set by the line, not by a step.
  // A container inside another that was reported is left alone.
  if (opts.columns?.length) {
    const scope = document.querySelector('main') ?? document.body
    const reported: Element[] = []
    for (const el of scope.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      if (!cs.maxWidth.endsWith('px')) continue
      const rect = el.getBoundingClientRect()
      const limit = parseFloat(cs.maxWidth)
      if (rect.width < 840 || rect.height < 100 || Math.abs(rect.width - limit) > 1 || el.closest('[aria-hidden=true], dialog')) continue
      if (reported.some((r) => r.contains(el))) continue
      reported.push(el)
      if (!opts.columns.some((width) => Math.abs(width - rect.width) <= 1))
        push('warning', 'column-width', el, 'A column of ' + Math.round(rect.width) + 'px, where DESIGN.md names ' + opts.columns.join('px, ') + 'px: pages take one of the named columns, so content stays on the same lines from page to page')
    }
  }

  // 6l. Equal ends. A bar, chip or capsule whose first and last items are the same kind (two controls, or two pieces of text) is as close to one
  // end as to the other: a circle with 17px before it and 5px after it reads as a mistake. When the ends differ (text at the start, a circle at
  // the end) the two gaps may differ too: that is optical (Apple's concentric shapes, a trailing icon in Material). A control that paints a circle
  // inside its own padding (a round icon button) is measured by the circle.
  {
    const clear = (value: string) => /^(rgba\(0, 0, 0, 0\)|transparent)$/.test(value)
    const interactive = 'button, a[href], input, select, textarea, summary, svg, img, [role=button]'
    const painted = (el: Element) => {
      const r = el.getBoundingClientRect()
      const c = getComputedStyle(el)
      if (c.backgroundClip !== 'content-box') return r
      const t = parseFloat(c.paddingTop) || 0, b = parseFloat(c.paddingBottom) || 0, l = parseFloat(c.paddingLeft) || 0, rt = parseFloat(c.paddingRight) || 0
      return { left: r.left + l, right: r.right - rt, top: r.top + t, bottom: r.bottom - b, width: r.width - l - rt, height: r.height - t - b }
    }
    for (const el of all) {
      const cs = getComputedStyle(el)
      if (!/flex|grid/.test(cs.display) || el.closest('[aria-hidden=true]') || el.matches(interactive)) continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 40 || rect.height < 28 || rect.height > 80) continue
      const lined = parseFloat(cs.borderLeftWidth) > 0 && !clear(cs.borderLeftColor)
      if (clear(cs.backgroundColor) && !lined) continue
      if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) continue
      const items: { left: number; right: number; top: number; bottom: number; kind: string }[] = []
      for (const node of el.childNodes) {
        if (node.nodeType === 3 && (node.textContent ?? '').trim()) {
          const range = document.createRange()
          range.selectNodeContents(node)
          const box = range.getBoundingClientRect()
          if (box.width > 0) items.push({ left: box.left, right: box.right, top: box.top, bottom: box.bottom, kind: 'text' })
        } else if (node.nodeType === 1) {
          const child = node as Element
          const c = getComputedStyle(child)
          const box = child.getBoundingClientRect()
          if (box.width <= 0 || box.height <= 0 || c.visibility === 'hidden' || c.position === 'absolute' || c.position === 'fixed') continue
          const drawn = !clear(c.backgroundColor) || (parseFloat(c.borderLeftWidth) > 0 && !clear(c.borderLeftColor))
          const shape = painted(child)
          items.push({ left: shape.left, right: shape.right, top: shape.top, bottom: shape.bottom, kind: child.matches(interactive) || child.querySelector(interactive) || drawn ? 'control' : 'text' })
        }
      }
      if (items.length < 2) continue
      const first = items.reduce((a, b) => (b.left < a.left ? b : a))
      const last = items.reduce((a, b) => (b.right > a.right ? b : a))
      if (first === last || first.kind !== last.kind) continue
      const start = first.left - (rect.left + parseFloat(cs.borderLeftWidth))
      const end = rect.right - parseFloat(cs.borderRightWidth) - last.right
      // A gap of more than 32px is room that nothing fills (a row packed to one side), not the padding of a bar.
      if (start < 0 || end < 0 || Math.abs(start - end) < 4 || Math.max(start, end) > 32) continue
      // Two controls of different sizes (a 24px logo and a 40px circle) are each as far from the end as from the top and bottom of the bar:
      // each end is concentric with its own item, and that is the rule, not one number for both.
      const above = (item: { top: number; bottom: number }) => Math.min(item.top - (rect.top + parseFloat(cs.borderTopWidth)), rect.bottom - parseFloat(cs.borderBottomWidth) - item.bottom)
      if (first.kind === 'control' && Math.abs(start - above(first)) <= 3 && Math.abs(end - above(last)) <= 3) continue
      push('warning', 'inset-asymmetry', el, 'Space of ' + Math.round(start) + 'px at the start and ' + Math.round(end) + 'px at the end, where both ends hold ' + (first.kind === 'text' ? 'text' : 'a control') + ': give both ends the same gap')
    }
  }

  // 6d. Touch targets: Material and Lighthouse want 48×48; a smaller one fails when the 48px square around its
  // centre covers a quarter of its area of another target (about 8px apart is enough). Touch-sized windows only.
  const named = (el: Element) => text(el) || el.getAttribute('aria-label') || el.tagName.toLowerCase()
  // Compared like overlaps (4b): behind an open modal only its own controls, and within one layer.
  if (W < 600)
    for (const el of solid) {
      if (solid.some((o) => o !== el && o.contains(el)) || proseLink(el)) continue
      const r = tapRect(el)
      if (r.width >= 48 && r.height >= 48) continue
      if (out.some((i) => i.type === 'tap-target' && i.selector === sel(el))) continue
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const hit = solid.find((o) => {
        if (o === el || o.contains(el) || el.contains(o) || layer(o) !== layer(el)) return false
        // A compound input's clear/reveal/list button occupies reserved padding,
        // not a neighbouring target. The same geometry as overlap checks keeps
        // insufficient padding and unrelated adjacent controls checked.
        if (reservedInputAction(el, o) || reservedInputAction(o, el) || emptyOverlay(el, o) || emptyOverlay(o, el)) return false
        // Only what can be seen and pressed is a neighbour: a row that a scrolling list clips is not close to what lies beyond the list.
        const q = tapRect(o)
        const parts = o instanceof HTMLInputElement && /^(checkbox|radio)$/.test(o.type) ? [q] : visibleRects(o)
        return parts.some((p) => {
          const ox = Math.max(0, Math.min(cx + 24, p.right) - Math.max(cx - 24, p.left))
          const oy = Math.max(0, Math.min(cy + 24, p.bottom) - Math.max(cy - 24, p.top))
          return ox * oy > 48
        })
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
    // The destinations stand in one row. A panel above them (a workout that is running, a player) belongs to the bar
    // but is not a destination: the widest row counts.
    const tops = items.map((i) => i.getBoundingClientRect().top).sort((a, b) => a - b)
    let widest = 0
    for (let from = 0, row = 0; row < tops.length; row++) {
      if (tops[row]! - tops[from]! > 12) from = row
      widest = Math.max(widest, row - from + 1)
    }
    if (widest > 5)
      push('warning', 'nav-destinations', el, widest + " destinations in the bottom navigation: Material's navigation bar holds 3–5")
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
  // The ring a focused control (or the row around it, :focus-within) draws, as it is now: its width and offset say how far past the box it reaches.
  const ringOf = (e: Element | null) => {
    if (!e) return ''
    const c = getComputedStyle(e)
    return c.outlineStyle === 'none' || !(parseFloat(c.outlineWidth) > 0) ? '' : c.outlineStyle + c.outlineWidth + c.outlineOffset + c.outlineColor
  }
  const ringChain = (e: HTMLElement) => [e, e.parentElement, e.parentElement?.parentElement ?? null].filter((n): n is HTMLElement => !!n)
  const before = document.activeElement as HTMLElement | null
  for (const el of interactive) {
    const h = el as HTMLElement
    if ((h as HTMLButtonElement).disabled || opacity(h) < 0.05) continue
    // A control that already has focus (an autofocused field) is compared from its unfocused look, not from the ring it already shows;
    // when the focus arrived before the check ran was a matter of timing.
    if (document.activeElement === h) h.blur()
    const was = frameOf(h)
    const ringsWas = ringChain(h).map(ringOf)
    h.focus({ preventScroll: true, focusVisible: true } as FocusOptions)
    if (document.activeElement !== h) continue
    const now = frameOf(h)
    // 6h-1. One ring: a control and the row around it both drawing one is a glitch (Material: one focus indicator).
    // 6h-2. Room for the ring: its 4px (2px width, 2px offset) lies outside the box, and a parent that clips (overflow, a dialog's surface)
    // cuts it when the control sits at its edge. Fix with padding on the container, or draw the ring inside (Red Hat: .focus-inside).
    const rings = ringChain(h).filter((n, i) => ringOf(n) && ringOf(n) !== ringsWas[i])
    const own = h.getBoundingClientRect()
    if (rings.length > 1 && own.width > 2)
      push('warning', 'ring-double', el, 'Two focus rings at once (the control and the row around it): draw one, around the row')
    else if (own.width > 2)
      for (const ring of rings) {
        const rc = getComputedStyle(ring)
        const reach = parseFloat(rc.outlineWidth) + parseFloat(rc.outlineOffset)
        if (!(reach > 0)) continue
        const box = ring.getBoundingClientRect()
        let cut: { sides: string[]; by: Element } | null = null
        for (let a = ring.parentElement; a && a !== document.body && a !== document.documentElement && !cut; a = a.parentElement) {
          const c = getComputedStyle(a)
          if ((c.overflowX === 'visible' && c.overflowY === 'visible') || !overflowClips(ring, a)) continue
          const q = a.getBoundingClientRect()
          const left = q.left + parseFloat(c.borderLeftWidth), right = q.right - parseFloat(c.borderRightWidth)
          const top = q.top + parseFloat(c.borderTopWidth), bottom = q.bottom - parseFloat(c.borderBottomWidth)
          // A control that is itself scrolled partly out of its container is cut by the scrolling, not by a missing margin.
          const x = c.overflowX !== 'visible', y = c.overflowY !== 'visible'
          if ((x && (box.left < left - 1 || box.right > right + 1)) || (y && (box.top < top - 1 || box.bottom > bottom + 1))) continue
          // A scroller cuts only where its content ends: a side that has more content beyond it (past the padding) scrolls the control into view.
          const more = (offset: number, size: number, total: number, start: number, end: number) => ({ before: offset - start > 0.5, after: total - (offset + size) - end > 0.5 })
          const hx = more(a.scrollLeft, a.clientWidth, a.scrollWidth, parseFloat(c.paddingLeft), parseFloat(c.paddingRight))
          const hy = more(a.scrollTop, a.clientHeight, a.scrollHeight, parseFloat(c.paddingTop), parseFloat(c.paddingBottom))
          const scrollsX = c.overflowX === 'auto' || c.overflowX === 'scroll', scrollsY = c.overflowY === 'auto' || c.overflowY === 'scroll'
          const sides = [
            x && !(scrollsX && hx.before) && box.left - reach < left - 0.5 ? 'left' : '', x && !(scrollsX && hx.after) && box.right + reach > right + 0.5 ? 'right' : '',
            y && !(scrollsY && hy.before) && box.top - reach < top - 0.5 ? 'top' : '', y && !(scrollsY && hy.after) && box.bottom + reach > bottom + 0.5 ? 'bottom' : '',
          ].filter(Boolean)
          if (sides.length) cut = { sides, by: a }
        }
        if (cut) {
          push('warning', 'ring-clipped', el, 'The focus ring is cut off at the ' + cut.sides.join(' and ') + ' by ' + sel(cut.by).split(' > ').pop() + ': leave ' + Math.ceil(reach) + 'px of room inside it (padding on the container), or draw the ring inside')
          break
        }
      }
    h.blur()
    if (was === now) push('warning', 'focus-visible', el, 'No visible focus: someone using a keyboard cannot see where they are (add a :focus-visible ring)')
  }
  before?.focus?.({ preventScroll: true })
  still.remove()

  // 6m. Room for a control's box (Fluent: space shows what belongs together; Material: 8dp between targets). A control draws its box when the pointer is on it
  // (the hover fill), when it is chosen, and for a press, so its box keeps 4px from the edge of what it sits on: the edge of its card, bar or panel, and the edge
  // of a neighbouring surface (a navigation bar above it). One that touches only one or two edges looks pushed against it. One that fills a surface on three sides
  // is the surface's content (a picture that opens, a row that spans a card), and a shape that paints inside its own box (a round or glass icon) is measured elsewhere.
  {
    const ROOM = 4
    const clear = (value: string) => /^(rgba\(0, 0, 0, 0\)|transparent)$/.test(value)
    // A surface is painted by a fill (all four edges are its edge) or by a line along some sides (only those sides are).
    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const
    const lined = (e: Element, side: (typeof sides)[number]) => {
      const c = getComputedStyle(e) as unknown as Record<string, string>
      return parseFloat(c['border' + side + 'Width']!) > 0 && !clear(c['border' + side + 'Color']!)
    }
    const filled = (e: Element) => {
      const c = getComputedStyle(e)
      return !clear(c.backgroundColor) || c.backgroundImage !== 'none'
    }
    const painted = (e: Element) => filled(e) || sides.some((side) => lined(e, side))
    const edgeDrawn = (e: Element, side: string) => filled(e) || lined(e, (side[0]!.toUpperCase() + side.slice(1)) as (typeof sides)[number])
    const surfaceOf = (el: Element) => {
      for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) if (painted(e)) return e
      return null
    }
    const controls = 'button, a[href], select, summary, [role=button], input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file])'
    const blocks = all
      .filter((e) => !e.matches(controls) && !e.querySelector(controls) && painted(e))
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter((b) => b.r.width >= 200 && b.r.height >= 8)
    for (const el of all) {
      if (!el.matches(controls) || opacity(el) < 0.05) continue
      const c = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (r.width < 32 || r.height < 32 || !(parseFloat(c.borderTopLeftRadius) >= 4) || c.display === 'contents') continue
      if (c.backgroundClip === 'content-box' || (getComputedStyle(el, '::after').position === 'absolute' && getComputedStyle(el, '::after').content !== 'none')) continue
      const touching: { side: string; by: Element }[] = []
      // A link that is only its words (no padding across, no fill, no line) has no box to fill: its sides are the words' edge, so only above and below count.
      const wordsOnly = parseFloat(c.paddingLeft) < ROOM && parseFloat(c.paddingRight) < ROOM && clear(c.backgroundColor) && !sides.some((side) => lined(el, side))
      const surface = surfaceOf(el)
      if (surface) {
        const q = surface.getBoundingClientRect()
        const sc = getComputedStyle(surface)
        const gaps: [string, number][] = [
          ['left', r.left - (q.left + parseFloat(sc.borderLeftWidth))], ['right', q.right - parseFloat(sc.borderRightWidth) - r.right],
          ['top', r.top - (q.top + parseFloat(sc.borderTopWidth))], ['bottom', q.bottom - parseFloat(sc.borderBottomWidth) - r.bottom],
        ]
        const near = gaps.filter(([side, gap]) => gap > -1 && gap < ROOM - 1 && edgeDrawn(surface, side) && !(wordsOnly && (side === 'left' || side === 'right')))
        if (near.length && near.length < 3 && gaps.every(([, gap]) => gap > -1)) for (const [side] of near) touching.push({ side, by: surface })
      }
      for (const b of blocks) {
        if (b.e.contains(el) || el.contains(b.e) || surface?.contains(b.e)) continue
        const across = Math.min(r.right, b.r.right) - Math.max(r.left, b.r.left)
        const along = Math.min(r.bottom, b.r.bottom) - Math.max(r.top, b.r.top)
        const above = r.top - b.r.bottom, below = b.r.top - r.bottom
        // The edge of the neighbour that faces the control is the one that has to be drawn.
        if (across >= 24 && above > -1 && above < ROOM - 1 && edgeDrawn(b.e, 'bottom')) touching.push({ side: 'top', by: b.e })
        else if (across >= 24 && below > -1 && below < ROOM - 1 && edgeDrawn(b.e, 'top')) touching.push({ side: 'bottom', by: b.e })
        else if (!wordsOnly && along >= 24 && r.left - b.r.right > -1 && r.left - b.r.right < ROOM - 1 && edgeDrawn(b.e, 'right')) touching.push({ side: 'left', by: b.e })
        else if (!wordsOnly && along >= 24 && b.r.left - r.right > -1 && b.r.left - r.right < ROOM - 1 && edgeDrawn(b.e, 'left')) touching.push({ side: 'right', by: b.e })
      }
      if (touching.length)
        push('warning', 'edge-flush', el, Math.round(r.width) + '×' + Math.round(r.height) + 'px control with its ' + touching[0]!.side + ' edge less than ' + ROOM + 'px from ' + sel(touching[0]!.by).split(' > ').pop() + ': leave ' + ROOM + 'px so its hover and focus fills have room')
    }
  }

  // 7. Motion uses DESIGN.md's durations (its motion: duration-* tokens): a transition of any other length is a
  // value someone typed, and screens drift apart in how they move.
  if (opts.durations?.length) {
    const named = opts.durations.map((d) => Math.round(d))
    for (const el of all) {
      const cs = getComputedStyle(el)
      if (cs.transitionProperty === 'none') continue
      const odd = cs.transitionDuration
        .split(',')
        .map((v) => (v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000))
        .find((ms) => ms > 0 && !named.includes(Math.round(ms)))
      if (odd !== undefined)
        push('warning', 'motion-token', el, 'Moves for ' + Math.round(odd) + "ms, a duration DESIGN.md's motion doesn't name (" + named.join(', ') + 'ms): use a duration-* token')
    }
  }

  // 6i. A medium window (600–1199 px: tablets, small laptops, Material's medium and expanded classes) is used: a
  // phone column in the middle of it, with most of the window empty, is a layout that stopped adapting. Only for a
  // page longer than the window (a list or a feed): a sign-in card or an empty state is narrow on purpose. Bars
  // fixed to an edge (a tab bar, a side navigation) don't count, and a side navigation's width is not available.
  const H = innerHeight
  if (W >= 600 && W < 1200 && document.documentElement.scrollHeight > H * 1.15) {
    const rail = (e: Element) => {
      const cs = getComputedStyle(e)
      if (cs.position !== 'fixed' && cs.position !== 'sticky') return false
      const r = e.getBoundingClientRect()
      return r.left <= 1 || r.right >= W - 1 || r.top <= 1 || r.bottom >= H - 1
    }
    const rails = new Set<Element>()
    let side = 0
    for (const el of all)
      if (rail(el)) {
        rails.add(el)
        const r = el.getBoundingClientRect()
        if (r.height >= H * 0.5 && r.width < W * 0.4) side = Math.max(side, r.width)
      }
    const inRail = (el: Element) => [...rails].some((r) => r.contains(el))
    const room = W - side
    let left = W, right = 0
    for (const el of all) {
      if (el === document.body || el === document.documentElement || inRail(el)) continue
      const cs = getComputedStyle(el)
      const box = (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || parseFloat(cs.borderTopWidth) > 0
      if (!(ownText(el) || box || el.matches('img, svg, input, textarea, select, button, [role="button"]'))) continue
      const r = el.getBoundingClientRect()
      if (r.width >= room * 0.95) continue
      left = Math.min(left, r.left)
      right = Math.max(right, r.right)
    }
    const used = right - left
    if (used > 0 && used < room * 0.6)
      push(
        'warning',
        'narrow-layout',
        document.querySelector('main') ?? document.body,
        'The content takes ' + Math.round(used) + ' of ' + Math.round(room) + 'px: a phone column in a wide window. Use the room (more columns, a side column) with the breakpoints, or give these widths to another variant',
      )
  }

  return out.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === 'error' ? -1 : 1))
}

/**
 * Runs inside the page with prefers-reduced-motion: reduce. What still moves (an animation of transform,
 * translate, scale, rotate or position) ignores the setting; fading and colour changes are fine.
 */
export function movingAnimations(): Issue[] {
  const MOVES = ['transform', 'translate', 'scale', 'rotate', 'left', 'top', 'right', 'bottom', 'marginTop', 'marginLeft', 'offsetDistance']
  const sel = (el: Element) => {
    const parts: string[] = []
    for (let e: Element | null = el; e && e !== document.body && parts.length < 6; e = e.parentElement) {
      let p = e.tagName.toLowerCase()
      const same = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e!.tagName) : []
      if (same.length > 1) p += ':nth-of-type(' + (same.indexOf(e) + 1) + ')'
      parts.unshift(p)
    }
    return parts.join(' > ')
  }
  const out: Issue[] = []
  const seen = new Set<Element>()
  for (const a of document.getAnimations()) {
    const effect = a.effect as KeyframeEffect | null
    const el = effect?.target
    if (!el || seen.has(el) || a.playState !== 'running') continue
    const moves = effect!.getKeyframes().some((k) => MOVES.some((p) => p in k))
    if (!moves) continue
    seen.add(el)
    if (out.length < 10)
      out.push({
        severity: 'warning',
        type: 'reduced-motion',
        selector: sel(el),
        text: (el.textContent ?? '').trim().slice(0, 60),
        message: 'Still moves with reduced motion on: wrap the animation in @media (prefers-reduced-motion: no-preference) (Tailwind motion-safe:), or fade instead',
      })
  }
  return out
}
