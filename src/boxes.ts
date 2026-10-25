/**
 * Where things sit on a page, for stitch2 geometry: the box of every shared component (by its data-<prefix> marker)
 * and of every piece of text, and the comparison of two pages' boxes. Boxes are paired by what they hold, not by
 * where they are in the markup, so a wrapper the app adds does not matter and data that differs is skipped.
 */

/** A piece of a page that can be found again on another page with the same words in it. */
export interface Box {
  /** What it is, without its place: a component's marker and its first words, or a text's own words. */
  sig: string
  /** "component" or "text". */
  kind: 'component' | 'text'
  /** For the report: “Save” or button “Save”. */
  label: string
  /** A figure or a symbol on its own (3, 93.1%, ←): data, which the other page may hold in another place or not at all. */
  data?: boolean
  /** Position on the page (scroll included) and size, in px. */
  x: number
  y: number
  w: number
  h: number
}

/** Runs in the page: the box of every visible component and every element's own text, in document order. Self-contained. */
export function boxes(prefix: string): Box[] {
  const marker = `data-${prefix}`
  const out: Box[] = []
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim()
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('script, style, noscript, template, option, svg')) continue
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
    const kind = el.getAttribute(marker)
    if (kind) {
      const r = el.getBoundingClientRect()
      if (r.width >= 1 && r.height >= 1) {
        const words = flat(el.textContent ?? '').slice(0, 24)
        out.push({
          sig: `${kind}|${words}`,
          kind: 'component',
          label: words ? `${kind} “${words}”` : kind,
          x: r.left + window.scrollX,
          y: r.top + window.scrollY,
          w: r.width,
          h: r.height,
        })
      }
    }
    let words = ''
    let left = Number.POSITIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    for (const n of el.childNodes) {
      if (n.nodeType !== Node.TEXT_NODE || !flat(n.textContent ?? '')) continue
      words += `${n.textContent ?? ''} `
      const range = document.createRange()
      range.selectNodeContents(n)
      const r = range.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      left = Math.min(left, r.left)
      top = Math.min(top, r.top)
      right = Math.max(right, r.right)
      bottom = Math.max(bottom, r.bottom)
    }
    words = flat(words)
    if (!words || !Number.isFinite(left)) continue
    out.push({
      sig: words.slice(0, 40),
      kind: 'text',
      data: !/\p{L}/u.test(words),
      label: `“${words.slice(0, 28)}”`,
      x: left + window.scrollX,
      y: top + window.scrollY,
      w: right - left,
      h: bottom - top,
    })
  }
  // A component with no words of its own (a picture, an icon) is known by the text that follows it: the title under it.
  for (const [i, b] of out.entries()) {
    if (b.kind !== 'component' || !b.sig.endsWith('|')) continue
    const after = out.slice(i + 1).find((o) => o.kind === 'text')
    if (!after) continue
    b.sig = `${b.sig}→${after.sig.slice(0, 24)}`
    b.label = `${b.label} before ${after.label}`
  }
  return out
}

export interface Mismatch {
  /** What differs: the size of a box, its left edge, the space to its neighbour, or how the two are arranged. */
  type: 'size' | 'position' | 'gap' | 'arrangement'
  message: string
}

export interface Compared {
  mismatches: Mismatch[]
  /** How many boxes were found on both pages. */
  matched: number
  onlyDesign: number
  onlyApp: number
}

/** How far apart two measurements may be before they differ: sub-pixel layout and rounding. */
export const TOLERANCE = { place: 2, size: 2, height: 3, gap: 3 }

const px = (v: number) => Math.round(v)

/** How a box sits to the one before it: inside it (a component and what it holds), beside it or below it. */
function relation(a: Box, b: Box): { how: 'inside' | 'beside' | 'below' | 'overlap'; dx: number; dy: number } {
  const inside = a.kind === 'component' && b.x >= a.x - 1 && b.y >= a.y - 1 && b.x + b.w <= a.x + a.w + 1 && b.y + b.h <= a.y + a.h + 1
  if (inside) return { how: 'inside', dx: b.x - a.x, dy: b.y - a.y }
  if (b.y >= a.y + a.h - 1) return { how: 'below', dx: 0, dy: b.y - (a.y + a.h) }
  if (b.x >= a.x + a.w - 1) return { how: 'beside', dx: b.x - (a.x + a.w), dy: 0 }
  return { how: 'overlap', dx: 0, dy: 0 }
}

/**
 * Of the indexes a list of pairs points to, the ones that keep their order: the longest run that only goes up. A
 * list that shows the same items in another order (recent runs, a feed) pairs many boxes with ones in other places;
 * only the pairs in the same order are comparable, the rest are data.
 */
function keepOrdered(pair: (number | undefined)[]): (number | undefined)[] {
  const at = pair.flatMap((p, i) => (p === undefined ? [] : [i]))
  const best: number[] = at.map(() => 1)
  const from: number[] = at.map(() => -1)
  let end = -1
  for (const [x, i] of at.entries()) {
    for (let y = 0; y < x; y++)
      if (pair[at[y]!]! < pair[i]! && best[y]! + 1 > best[x]!) {
        best[x] = best[y]! + 1
        from[x] = y
      }
    if (end < 0 || best[x]! > best[end]!) end = x
  }
  const keep = new Set<number>()
  for (let x = end; x >= 0; x = from[x]!) keep.add(at[x]!)
  return pair.map((p, i) => (keep.has(i) ? p : undefined))
}

/**
 * Pairs the boxes of two pages (the nth box with a given content on one is the nth on the other) and lists where
 * the pairs differ: size, left edge, and the space between neighbours. Vertical position alone is not compared,
 * because data of another length moves everything below it; the space between two neighbours is.
 * Across a row, text that only one page has (a name, a balance) pushes its row-mates sideways for good reason, so
 * left edges and sideways gaps are compared only where no such text shares the row.
 */
export function compareBoxes(design: Box[], app: Box[]): Compared {
  const key = (list: Box[]) => {
    const seen = new Map<string, number>()
    return list.map((b) => {
      const i = seen.get(b.sig) ?? 0
      seen.set(b.sig, i + 1)
      return `${b.sig}#${i}`
    })
  }
  const [dk, ak] = [key(design), key(app)]
  const inApp = new Map(ak.map((k, i) => [k, i]))
  const pair = keepOrdered(dk.map((k, i) => (design[i]!.data ? undefined : inApp.get(k))))
  const paired = new Set(pair)
  const loose = (list: Box[], keep: (i: number) => boolean) => list.filter((b, i) => b.kind === 'text' && !keep(i))
  const looseDesign = loose(design, (i) => pair[i] !== undefined)
  const looseApp = loose(app, (i) => paired.has(i))
  /** Whether text only one page has shares the row of this box, outside it: it can move the box sideways. */
  const crowded = (list: Box[], b: Box) => list.some((u) => u.y < b.y + b.h && u.y + u.h > b.y && !(u.x >= b.x - 1 && u.x + u.w <= b.x + b.w + 1))
  const inside = (list: Box[], b: Box) => list.some((u) => u.x >= b.x - 1 && u.y >= b.y - 1 && u.x + u.w <= b.x + b.w + 1 && u.y + u.h <= b.y + b.h + 1)
  const mismatches: Mismatch[] = []
  let matched = 0
  for (const [i, d] of design.entries()) {
    const j = pair[i]
    if (j === undefined) continue
    matched++
    const a = app[j]!
    // What a component holds sets its height: where one page has text the other lacks, only its width is compared.
    const holds = d.kind === 'component' && (inside(looseDesign, d) || inside(looseApp, a))
    if (Math.abs(d.w - a.w) > TOLERANCE.size || (!holds && Math.abs(d.h - a.h) > TOLERANCE.height))
      mismatches.push({ type: 'size', message: `${d.label} is ${px(a.w)}×${px(a.h)} in the app, ${px(d.w)}×${px(d.h)} in the design` })
    if (Math.abs(d.x - a.x) > TOLERANCE.place && !crowded(looseDesign, d) && !crowded(looseApp, a))
      mismatches.push({ type: 'position', message: `${d.label} starts ${px(a.x)}px from the left in the app, ${px(d.x)}px in the design` })
    const next = design[i + 1]
    const k = pair[i + 1]
    if (!next || k === undefined || k !== j + 1) continue
    const [rd, ra] = [relation(d, next), relation(a, app[k]!)]
    if (rd.how === 'overlap' || ra.how === 'overlap') continue
    if (rd.how !== ra.how) {
      mismatches.push({ type: 'arrangement', message: `${next.label} sits ${rd.how} ${d.label} in the design, ${ra.how} it in the app` })
      continue
    }
    if (rd.how === 'inside') {
      const sideways = !crowded(looseDesign, next) && !crowded(looseApp, app[k]!) && Math.abs(rd.dx - ra.dx) > TOLERANCE.gap
      if (sideways || Math.abs(rd.dy - ra.dy) > TOLERANCE.gap)
        mismatches.push({
          type: 'gap',
          message: `${next.label} sits ${px(ra.dx)}px across and ${px(ra.dy)}px down inside ${d.label} in the app, ${px(rd.dx)}px and ${px(rd.dy)}px in the design`,
        })
      continue
    }
    const [gd, ga] = rd.how === 'beside' ? [rd.dx, ra.dx] : [rd.dy, ra.dy]
    if (rd.how === 'beside' && (crowded(looseDesign, d) || crowded(looseApp, a))) continue
    if (Math.abs(gd - ga) > TOLERANCE.gap)
      mismatches.push({ type: 'gap', message: `between ${d.label} and ${next.label}: ${px(ga)}px in the app, ${px(gd)}px in the design` })
  }
  return { mismatches, matched, onlyDesign: design.length - matched, onlyApp: app.length - matched }
}
