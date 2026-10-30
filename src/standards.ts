/**
 * Checks that come from published standards rather than from one project's rules: WCAG 2.2 (1.3.1 headings and images, 1.3.5 autocomplete, 1.4.10 reflow,
 * 1.4.11 non-text contrast, 1.4.12 text spacing, 2.4.3 focus order, 2.4.7 and 2.4.13 focus), the ARIA authoring practices for dialogs, forced-colors mode (MDN),
 * and the rules of DESIGN.md that a page can only break by drawing (word space, concentric corners, links that are buttons, controls that are not centred).
 * Runs inside the page, like audit; check calls both. Plain JS on purpose: Playwright sends its source to the browser.
 */
import type { Issue } from './typecheck.ts'

/** Types that depend on the theme's colours: check runs them again in every theme, as it does contrast. */
export const COLOUR_TYPES = ['contrast', 'focus-contrast', 'field-edge']

export async function standards(opts: { full?: boolean }): Promise<Issue[]> {
  const W = document.documentElement.clientWidth
  const out: Issue[] = []
  const sel = (el: Element) => {
    const parts: string[] = []
    for (let e: Element | null = el; e && e !== document.body && parts.length < 6; e = e.parentElement) {
      if (e.id) {
        parts.unshift('#' + CSS.escape(e.id))
        break
      }
      let p = e.tagName.toLowerCase()
      const same = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e!.tagName) : []
      if (same.length > 1) p += ':nth-of-type(' + (same.indexOf(e) + 1) + ')'
      parts.unshift(p)
    }
    return parts.join(' > ')
  }
  const words = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
  const push = (severity: Issue['severity'], type: string, el: Element, message: string) => {
    if (out.filter((i) => i.type === type).length >= 10) return
    out.push({ severity, type, message, selector: sel(el), text: words(el) })
  }
  const seen = (el: Element) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false
    const closed = el.closest('details:not([open])')
    if (closed && !closed.querySelector(':scope > summary')?.contains(el)) return false
    const r = el.getBoundingClientRect()
    if (r.width <= 1 && r.height <= 1 && cs.position === 'absolute') return false
    return r.width > 0 && r.height > 0
  }
  const all = [...document.body.querySelectorAll('*')].filter((el) => !el.closest('svg') || el.tagName.toLowerCase() === 'svg')
  const shown = all.filter(seen)
  const FOCUSABLE = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])'

  // ---- Colour helpers: a colour as the page paints it, over what is behind it ----
  type Colour = { r: number; g: number; b: number; a: number }
  const parse = (value: string): Colour | null => {
    const nums = (value.match(/-?[\d.]+(?:e-?\d+)?%?/g) ?? []).map((n) => (n.endsWith('%') ? parseFloat(n) / 100 : parseFloat(n)))
    if (value.startsWith('rgb') && nums.length >= 3) return { r: nums[0]!, g: nums[1]!, b: nums[2]!, a: nums[3] ?? 1 }
    if (value.startsWith('color(srgb') && nums.length >= 3) return { r: nums[0]! * 255, g: nums[1]! * 255, b: nums[2]! * 255, a: nums[3] ?? 1 }
    return null
  }
  const over = (top: Colour, below: Colour): Colour => {
    const a = top.a + below.a * (1 - top.a)
    if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 }
    return { r: (top.r * top.a + below.r * below.a * (1 - top.a)) / a, g: (top.g * top.a + below.g * below.a * (1 - top.a)) / a, b: (top.b * top.a + below.b * below.a * (1 - top.a)) / a, a }
  }
  // What is behind an element: the backgrounds of its ancestors, nearest first, until one is opaque. A picture or a gradient on the way is not known.
  const behind = (el: Element): Colour | null => {
    const layers: Colour[] = []
    let opaque = false
    for (let e = el.parentElement; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      const c = parse(cs.backgroundColor)
      if (cs.backgroundImage !== 'none' && !opaque && !(c && c.a >= 0.99)) return null
      if (c && c.a > 0) layers.push(c)
      if (c && c.a >= 0.99) {
        opaque = true
        break
      }
    }
    let base: Colour = { r: 255, g: 255, b: 255, a: 1 }
    for (const layer of layers.reverse()) base = over(layer, base)
    return base
  }
  const luminance = (c: Colour) => {
    const lin = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
  }
  const ratio = (a: Colour, b: Colour) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi! + 0.05) / (lo! + 0.05)
  }
  const flat = (c: Colour) => ({ ...c, a: 1 })

  // ---- 1. Links are links (DESIGN.md: Links Are Links Rule). A destination in a bar or a footer is an anchor, not a button painted like one. ----
  for (const el of shown) {
    if (!el.matches('button')) continue
    if (!el.closest('nav, footer, header, [role=navigation], [role=contentinfo]') || el.closest('form, dialog, [role=dialog], [role=menu], [role=tablist]')) continue
    if (el.matches('[aria-haspopup], [aria-expanded], [aria-controls], [aria-pressed], [aria-checked], [role=tab], [role=switch], [role=menuitem], [type=submit], [type=reset], [data-copy]')) continue
    if (Object.keys((el as HTMLElement).dataset).some((k) => /open|toggle|close|copy|menu|dialog|action/i.test(k))) continue
    if (!words(el)) continue
    // Pagination is a button where it changes a list in place (and the address with pushState); its labels say so.
    if (/^(←\s*)?(previous|next|back|forward)(\s*→)?$|^\d+$/i.test(words(el)) || /page/i.test(el.closest('nav')?.getAttribute('aria-label') ?? '')) continue
    push('warning', 'link-as-button', el, 'A button where a link goes: something in a bar or a footer that changes the address is an anchor (it opens in a new tab, it is found by the keyboard and by a screen reader as a link)')
  }

  // ---- 1b. The page itself: a language (WCAG 3.1.1), a title (2.4.2), a landmark to skip to (2.4.1), and zoom left alone (1.4.4). ----
  {
    const html = document.documentElement
    if (!html.lang?.trim()) push('warning', 'page-lang', html, 'The page has no lang: a screen reader cannot choose a voice, and the browser cannot choose hyphenation or quotes (WCAG 3.1.1)')
    if (!document.title?.trim()) push('warning', 'page-title', html, 'The page has no title: it is the first thing a screen reader says and the name in the tab (WCAG 2.4.2)')
    if (shown.length > 20 && !document.querySelector('main, [role=main]')) push('warning', 'landmark-main', document.body, 'The page has no main landmark: the keyboard and a screen reader cannot skip to the content (WCAG 2.4.1)')
    const viewport = document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? ''
    if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?(\s|,|$)/i.test(viewport)) push('warning', 'zoom-blocked', document.head, 'The viewport blocks zoom (' + viewport + '): a person who needs larger text cannot have it (WCAG 1.4.4)')
  }

  // ---- 2. Headings (WCAG 1.3.1): levels follow each other without a gap, and the page has one h1. ----
  {
    const headings = all.filter((el) => /^h[1-6]$/i.test(el.tagName) || (el.getAttribute('role') === 'heading' && el.getAttribute('aria-level'))).filter((el) => el.checkVisibility({ visibilityProperty: true }))
    const level = (el: Element) => (/^h[1-6]$/i.test(el.tagName) ? Number(el.tagName[1]) : Number(el.getAttribute('aria-level')))
    let before = 0
    for (const h of headings) {
      const now = level(h)
      if (before && now > before + 1) push('warning', 'heading-order', h, 'A heading of level ' + now + ' after level ' + before + ': levels follow each other without a gap, so the outline a screen reader lists is a tree (WCAG 1.3.1)')
      before = now
    }
    const ones = headings.filter((h) => level(h) === 1)
    if (headings.length && ones.length !== 1) push('warning', 'h1-count', ones[0] ?? headings[0]!, ones.length ? ones.length + ' headings of level 1: a page has one, its name' : 'No heading of level 1: a page has one, its name (WCAG 2.4.6, 1.3.1)')
  }

  // ---- 3. Pictures: a text alternative, and a file that loads (WCAG 1.1.1). ----
  for (const el of all) {
    if (!(el instanceof HTMLImageElement) || !seen(el)) continue
    if (!el.hasAttribute('alt') && !el.matches('[role=presentation], [role=none], [aria-hidden=true]')) push('warning', 'img-alt', el, 'A picture with no alt attribute: write what it shows, or alt="" when it only decorates')
    const src = el.getAttribute('src') ?? ''
    if (el.complete && !el.naturalWidth && src && !src.startsWith('data:') && el.loading !== 'lazy') push('warning', 'img-broken', el, 'The picture does not load (' + src.slice(0, 50) + ')')
  }

  // ---- 4. Autocomplete (WCAG 1.3.5): a field about the person names what it asks for, so the browser can fill it. ----
  for (const el of shown) {
    if (!(el instanceof HTMLInputElement) || el.matches('[type=hidden], [type=checkbox], [type=radio], [type=submit], [type=button], [type=range], [type=file], [type=search], [type=number], [type=date]') || el.closest('[role=search], search')) continue
    const hay = (el.name + ' ' + el.id + ' ' + (el.getAttribute('aria-label') ?? '') + ' ' + el.placeholder).toLowerCase()
    const purpose = el.type === 'email' || /e-?mail/.test(hay) ? 'email' : el.type === 'password' ? 'password' : el.type === 'tel' || /phone|mobile/.test(hay) ? 'tel'
      : /first.?name|given/.test(hay) ? 'given-name' : /last.?name|family|surname/.test(hay) ? 'family-name' : /(^|[^a-z])name([^a-z]|$)/.test(hay) && !/user|file|pipeline|model|project/.test(hay) ? 'name'
      : /postal|zip/.test(hay) ? 'postal-code' : /street|address/.test(hay) ? 'street-address' : /card.?num|cc-?num/.test(hay) ? 'cc-number' : ''
    if (purpose && (!el.autocomplete || el.autocomplete === 'off')) push('warning', 'autocomplete', el, 'A field for ' + purpose + ' with no autocomplete="' + purpose + '" (WCAG 1.3.5): the browser cannot fill it in')
  }

  // ---- 4b. A field has a name that is not its placeholder (WCAG 3.3.2, 4.1.2): a visible label, aria-label or aria-labelledby. ----
  for (const el of shown) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || el.matches('[type=hidden], [type=submit], [type=button], [type=reset], [type=image]')) continue
    const named = (el.labels && el.labels.length > 0) || el.getAttribute('aria-label')?.trim() || el.getAttribute('title')?.trim() || (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).some((id) => document.getElementById(id)?.textContent?.trim())
    if (!named) push('warning', 'field-name', el, 'A field with no label, aria-label or aria-labelledby: a screen reader announces an unnamed box (a placeholder is not a name, WCAG 3.3.2)')
  }

  // ---- 5. A dialog has a name (ARIA authoring practices) and something to press. ----
  for (const el of shown) {
    if (!el.matches('dialog[open], [role=dialog], [role=alertdialog]')) continue
    const labelled = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join('').trim()
    if (!el.getAttribute('aria-label')?.trim() && !labelled) push('warning', 'dialog-name', el, 'A dialog with no name: aria-labelledby its title, or aria-label')
    else if (!el.querySelector(FOCUSABLE)) push('warning', 'dialog-name', el, 'A dialog with nothing to press: focus has nowhere to go, and nothing closes it')
  }

  // ---- 6. A placeholder fits its field: it cannot scroll, so what does not fit is cut. ----
  {
    const probe = document.createElement('div')
    document.body.append(probe)
    for (const el of shown) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !el.placeholder || el.value || (el instanceof HTMLInputElement && !/^(text|email|tel|url|search|password)$/.test(el.type))) continue
      const cs = getComputedStyle(el)
      const width = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const height = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      const multi = el instanceof HTMLTextAreaElement
      probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;font:' + cs.font + ';letter-spacing:' + cs.letterSpacing + ';word-spacing:' + cs.wordSpacing + ';text-transform:' + cs.textTransform + ';line-height:' + cs.lineHeight + ';white-space:' + (multi ? 'pre-wrap' : 'nowrap') + ';overflow-wrap:break-word;' + (multi ? 'width:' + width + 'px' : '')
      probe.textContent = el.placeholder
      const box = probe.getBoundingClientRect()
      if (multi ? box.height > height + 1 : box.width > width + 1) push('warning', 'placeholder-fit', el, 'The placeholder does not fit its field (' + Math.round(multi ? box.height : box.width) + 'px of ' + Math.round(multi ? height : width) + 'px): it is cut. Shorten it, or give the field room')
    }
    probe.remove()
  }

  // ---- 7. Centred: the label in the middle of its control, and the words of a choice level with its box. ----
  for (const el of shown) {
    if (el.matches('button, summary, [role=button], [role=combobox], [role=tab]') && !el.querySelector('img, video, canvas, picture')) {
      const box = el.getBoundingClientRect()
      const rects: DOMRect[] = []
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim() || n.parentElement?.closest('svg') || !seen(n.parentElement!)) continue
        // A badge pinned to a corner (position: absolute) is not the label.
        let pinned = false
        for (let e = n.parentElement; e && e !== el; e = e.parentElement) if (getComputedStyle(e).position === 'absolute') pinned = true
        if (pinned) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        rects.push(...[...range.getClientRects()].filter((q) => q.width > 1))
      }
      if (!rects.length) continue
      const tops = new Set(rects.map((q) => Math.round(q.top)))
      if (tops.size > 1 && Math.max(...tops) - Math.min(...tops) > rects[0]!.height / 2) continue
      const middle = (Math.min(...rects.map((q) => q.top)) + Math.max(...rects.map((q) => q.bottom))) / 2
      const off = middle - (box.top + box.height / 2)
      if (Math.abs(off) > 2 && box.height < 120) push('warning', 'label-centered', el, 'The label sits ' + Math.abs(Math.round(off)) + 'px ' + (off < 0 ? 'above' : 'below') + ' the middle of its control')
    }
    if (el instanceof HTMLInputElement && /^(checkbox|radio)$/.test(el.type)) {
      const label = el.labels?.[0]
      const box = el.getBoundingClientRect()
      if (!label || box.width < 8) continue
      const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT)
      let first: DOMRect | undefined
      for (let n = walker.nextNode(); n && !first; n = walker.nextNode()) {
        if (!n.textContent?.trim() || n.parentElement?.closest('svg')) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        first = [...range.getClientRects()].find((q) => q.width > 1)
      }
      if (!first) continue
      const off = first.top + first.height / 2 - (box.top + box.height / 2)
      if (Math.abs(off) > 3) push('warning', 'choice-alignment', el, 'The words of this choice are ' + Math.abs(Math.round(off)) + 'px ' + (off < 0 ? 'above' : 'below') + ' the middle of its box: they share a line')
    }
  }

  // ---- 8. Arrows, icons and rows that are drawn twice or off centre. ----
  for (const el of shown) {
    if (el instanceof HTMLSelectElement && !el.multiple && el.size <= 1) {
      const cs = getComputedStyle(el)
      const parent = el.closest('.p2-select')?.parentElement ?? el.parentElement
      const drawn = [...(parent?.children ?? [])].filter((n) => n.tagName.toLowerCase() === 'svg' && getComputedStyle(n).position === 'absolute').length
      const own = cs.appearance === 'none' && cs.backgroundImage !== 'none' ? 1 : 0
      const native = cs.appearance !== 'none' ? 1 : 0
      if (drawn + own + native > 1) push('warning', 'select-two-arrows', el, 'A select with two arrows: the browser draws one and the page draws another')
    }
    if (el.tagName.toLowerCase() === 'svg') {
      const cs = getComputedStyle(el)
      // An SVG has no offsetParent: the box it is placed in is its nearest positioned ancestor.
      let parent: Element | null = el.parentElement
      while (parent && parent !== document.body && getComputedStyle(parent).position === 'static') parent = parent.parentElement
      if (cs.position !== 'absolute' || !parent || parent === document.body || parent.closest('svg') || cs.top === 'auto') continue
      const box = parent.getBoundingClientRect(), mark = el.getBoundingClientRect()
      if (box.height && Math.abs(parseFloat(cs.top) - box.height / 2) <= 1.5 && Math.abs(mark.top + mark.height / 2 - (box.top + box.height / 2)) > 2) push('warning', 'icon-off-centre', el, 'An icon placed at the middle of its box by its top edge, so it hangs below the middle (translate it back by half its height)')
    }
  }
  {
    const rows = new Map<string, { el: Element; h: number }[]>()
    for (const el of shown) {
      if (!el.parentElement || !/grid|flex/.test(getComputedStyle(el.parentElement).display)) continue
      const cs = getComputedStyle(el), r = el.getBoundingClientRect()
      const painted = parseFloat(cs.borderTopWidth) > 0 || parse(cs.backgroundColor)?.a! > 0.01
      if (!painted || parseFloat(cs.borderTopLeftRadius) < 8 || r.width < 120 || r.height < 60) continue
      const key = sel(el.parentElement) + '|' + Math.round(r.top + scrollY)
      rows.set(key, [...(rows.get(key) ?? []), { el, h: r.height }])
    }
    for (const list of rows.values()) {
      if (list.length < 2) continue
      const hs = list.map((x) => x.h)
      if (Math.max(...hs) - Math.min(...hs) > 3) push('warning', 'row-heights', list[hs.indexOf(Math.min(...hs))]!.el, 'Cards of one row end at different heights (' + hs.map(Math.round).join(', ') + 'px): stretch them, or the row reads as a mistake')
    }
  }

  // ---- 9. Focus order (WCAG 2.4.3, 1.3.2): the order the keyboard takes is the order the eye reads, so nothing is moved by CSS under focusable content. ----
  for (const el of all) {
    if (el.matches('[tabindex]') && Number(el.getAttribute('tabindex')) > 0) push('warning', 'focus-order', el, 'tabindex above 0 puts this control before every other: leave the order to the document')
    const cs = getComputedStyle(el)
    if (!/flex|grid/.test(cs.display) || !seen(el)) continue
    const reversed = /reverse/.test(cs.flexDirection)
    const moved = [...el.children].filter((k) => getComputedStyle(k).order !== '0' && (k.matches(FOCUSABLE) || k.querySelector(FOCUSABLE)))
    if ((reversed && el.querySelector(FOCUSABLE)) || moved.length) push('warning', 'focus-order', el, (reversed ? 'A reversed row' : 'An item moved with order') + ' holds controls: the keyboard takes them in the order of the document, not the order drawn (WCAG 2.4.3). Write them in the order they are drawn')
  }

  // ---- 10. Word space (DESIGN.md: Word-Space Rule): a face whose space is under 0.24em joins words at reading size. ----
  {
    const ctx = document.createElement('canvas').getContext('2d')!
    const done = new Set<string>()
    for (const el of shown) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) || el.closest('pre, code, svg')) continue
      const cs = getComputedStyle(el)
      const family = cs.fontFamily.split(',')[0]!.replace(/["']/g, '').trim()
      if (/material|symbols|icons|mono/i.test(family) || done.has(family + cs.fontWeight)) continue
      done.add(family + cs.fontWeight)
      ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' 100px ' + cs.fontFamily
      const space = ctx.measureText(' ').width / 100
      // 0.24em is the rule; hinting makes a face that has it measure 0.23 at some weights, so what is reported is clearly under (Plus Jakarta Sans measures 0.17).
      if (space < 0.22) push('warning', 'word-space', el, family + ' has a word space of ' + space.toFixed(2) + 'em, under 0.24em: words join at reading size, and tracking cannot repair it (replace the face)')
    }
  }

  // ---- 11. Concentric corners (DESIGN.md): a surface inside a rounded surface takes the outer radius less the space between them. ----
  for (const el of shown) {
    const cs = getComputedStyle(el)
    const R = parseFloat(cs.borderTopLeftRadius)
    if (!(R >= 8) || cs.borderTopLeftRadius !== cs.borderBottomRightRadius || cs.overflow === 'visible' && !(parse(cs.backgroundColor)?.a! > 0.01 || parseFloat(cs.borderTopWidth) > 0)) continue
    const outer = el.getBoundingClientRect()
    const bw = parseFloat(cs.borderTopWidth)
    for (const kid of el.children) {
      if (!seen(kid)) continue
      const kc = getComputedStyle(kid)
      const r = parseFloat(kc.borderTopLeftRadius)
      if (!(parse(kc.backgroundColor)?.a! > 0.01 || parseFloat(kc.borderTopWidth) > 0) || r === 0 || kc.borderTopLeftRadius !== kc.borderBottomRightRadius) continue
      const k = kid.getBoundingClientRect()
      const gaps = [k.left - outer.left - bw, outer.right - bw - k.right, k.top - outer.top - bw, outer.bottom - bw - k.bottom]
      if (Math.min(...gaps) < 2 || Math.max(...gaps) - Math.min(...gaps) > 2 || Math.min(...gaps) >= R) continue
      const want = R - Math.min(...gaps)
      if (Math.abs(r - want) > 3) push('warning', 'concentric-corner', kid, 'A corner of ' + Math.round(r) + 'px inside a ' + Math.round(R) + 'px surface with ' + Math.round(Math.min(...gaps)) + 'px between them: concentric is ' + Math.round(want) + 'px (outer radius less the space)')
    }
  }

  // ---- 11b. The Four-Pixel Rhythm Rule (DESIGN.md): structural spacing is on the four-pixel grid. One report for each value that is not; a centred margin and a size that comes from a percentage are not spacing. ----
  {
    const props = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap'] as const
    const done = new Set<number>()
    for (const el of shown) {
      if (el.closest('svg')) continue
      const cs = getComputedStyle(el) as unknown as Record<string, string>
      for (const p of props) {
        const v = parseFloat(cs[p]!)
        if (!(v >= 3) || v > 200 || done.has(Math.round(v * 100)) || Math.abs(v / 4 - Math.round(v / 4)) < 0.01) continue
        if (/^margin(Left|Right)$/.test(p) && cs.marginLeft === cs.marginRight && el.parentElement && Math.abs(el.getBoundingClientRect().left - (el.parentElement.getBoundingClientRect().right - el.getBoundingClientRect().right)) < 2) continue
        done.add(Math.round(v * 100))
        push('warning', 'spacing-grid', el, Math.round(v * 100) / 100 + 'px of ' + p.replace(/([A-Z])/g, ' $1').toLowerCase() + ' is off the four-pixel grid: structural spacing takes a step of 4px (4, 8, 12, 16, 24, 32…); a half step is for an optical correction in a component')
      }
    }
  }

  // ---- 12. Focus: the indicator is an outline that survives forced colours (MDN, Windows High Contrast), and it is 3:1 against what it touches (WCAG 1.4.11, 2.4.13). ----
  if (opts.full) {
    const reported = new Set<string>()
    const chain = (e: HTMLElement) => [e, e.parentElement, e.parentElement?.parentElement ?? null].filter((n): n is HTMLElement => !!n)
    const signs = (e: HTMLElement) => chain(e).map((n) => {
      const c = getComputedStyle(n)
      return { outline: c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0 ? c.outlineStyle + c.outlineWidth : '', structure: c.borderTopStyle + c.borderTopWidth + c.borderBottomWidth + c.textDecorationLine, paint: [c.boxShadow, c.backgroundColor, c.borderTopColor, c.color].join('|') }
    })
    const still = document.createElement('style')
    still.textContent = '*, *::before, *::after { transition: none !important; animation: none !important }'
    document.head.append(still)
    const before = document.activeElement as HTMLElement | null
    for (const el of shown) {
      if (!el.matches(FOCUSABLE) || (el as HTMLButtonElement).disabled) continue
      const h = el as HTMLElement
      if (document.activeElement === h) h.blur()
      const was = signs(h)
      h.focus({ preventScroll: true, focusVisible: true } as FocusOptions)
      if (document.activeElement !== h) continue
      const now = signs(h)
      const ring = chain(h).find((n, i) => now[i]!.outline && now[i]!.outline !== was[i]!.outline)
      if (ring) {
        const rc = getComputedStyle(ring)
        const colour = parse(rc.outlineColor), back = behind(ring)
        if (colour && back) {
          const ink = over(colour, flat(back))
          const r = ratio(ink, flat(back))
          const key = rc.outlineColor + '|' + rc.backgroundColor + back.r.toFixed(0)
          if (r < 3 && !reported.has(key)) {
            reported.add(key)
            push('warning', 'focus-contrast', ring, 'The focus ring is ' + r.toFixed(1) + ':1 against what it touches; WCAG 1.4.11 and 2.4.13 ask for 3:1')
          }
        }
      } else if (now.some((s, i) => s.paint !== was[i]!.paint) && !now.some((s, i) => s.structure !== was[i]!.structure)) {
        push('warning', 'focus-forced-colors', el, 'The focus is shown by a shadow or a colour only: forced-colors mode (Windows High Contrast) removes both, and the keyboard loses its place. Draw it as an outline')
      }
      h.blur()
    }
    before?.focus?.({ preventScroll: true })
    still.remove()
  }

  // ---- 13. A field can be seen (WCAG 1.4.11): its edge, or its fill, is 3:1 against what is behind it. One report for each way of drawing it. ----
  {
    const reported = new Set<string>()
    for (const el of shown) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || el.matches('[type=hidden], [type=checkbox], [type=radio], [type=range], [type=file], [type=submit], [type=button]')) continue
      const cs = getComputedStyle(el)
      const back = behind(el)
      if (!back) continue
      const edge = parse(cs.borderTopColor), fill = parse(cs.backgroundColor)
      const sides = [cs.borderTopWidth, cs.borderBottomWidth, cs.borderLeftWidth, cs.borderRightWidth].some((w) => parseFloat(w) >= 1)
      const base = flat(back)
      const edgeRatio = sides && edge ? ratio(over(edge, base), base) : 0
      const fillRatio = fill && fill.a > 0 ? ratio(over(fill, base), base) : 0
      if (edgeRatio >= 3 || fillRatio >= 3) continue
      const key = cs.borderTopColor + '|' + cs.backgroundColor + '|' + back.r.toFixed(0)
      if (reported.has(key)) continue
      reported.add(key)
      push('warning', 'field-edge', el, 'The edge of this field is ' + Math.max(edgeRatio, fillRatio).toFixed(1) + ':1 against what is behind it; WCAG 1.4.11 asks for 3:1 for the edge that shows where a field is')
    }
  }

  // ---- 14. Text spacing (WCAG 1.4.12): a person who sets the line height to 1.5, letters to 0.12em and words to 0.16em loses nothing. Run last: it changes the page, and puts it back. ----
  if (opts.full) {
    const clipped = () => {
      const set = new Set<Element>()
      for (const el of document.body.querySelectorAll('*')) {
        const cs = getComputedStyle(el)
        if ((cs.overflowX === 'visible' && cs.overflowY === 'visible') || cs.textOverflow === 'ellipsis' || /-webkit-box/.test(cs.display) || cs.webkitLineClamp !== 'none' || !(el.textContent ?? '').trim()) continue
        if ((cs.overflowY !== 'visible' && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll' && el.scrollHeight > el.clientHeight + 1) || (cs.overflowX !== 'visible' && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && el.scrollWidth > el.clientWidth + 1)) set.add(el)
      }
      return set
    }
    const was = clipped()
    const wide = document.documentElement.scrollWidth > W + 1
    const style = document.createElement('style')
    style.textContent = '*, *::before, *::after { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; transition: none !important } p { margin-bottom: 2em !important }'
    document.head.append(style)
    void document.body.offsetHeight
    for (const el of clipped()) if (!was.has(el)) push('warning', 'text-spacing', el, 'Text is cut off when a person sets the spacing WCAG 1.4.12 asks to support (line height 1.5, letters 0.12em, words 0.16em): give the box room, do not fix its height')
    if (!wide && document.documentElement.scrollWidth > W + 1) push('warning', 'text-spacing', document.body, 'The page scrolls sideways when a person sets the spacing WCAG 1.4.12 asks to support (line height 1.5, letters 0.12em, words 0.16em)')
    style.remove()
  }

  return out
}
