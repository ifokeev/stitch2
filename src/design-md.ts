/**
 * Reads design/DESIGN.md's YAML front matter (the DESIGN.md format: colors, typography, rounded, spacing,
 * components) and resolves {path.to.token} references. stitch2 adds motion: duration-<name> and ease-<name>
 * tokens (Google's format has no motion yet; stitch2 lint leaves the linter's note about the key out).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { config } from './config.ts'
import { ROOT } from './screens.ts'

export interface TypeLevel {
  fontFamily?: string
  fontSize?: string
  fontWeight?: number | string
  lineHeight?: string | number
  letterSpacing?: string
  fontFeature?: string
}

export interface Design {
  name: string
  colors: Record<string, string>
  typography: Record<string, TypeLevel>
  rounded: Record<string, string>
  spacing: Record<string, string>
  components: Record<string, Record<string, string>>
  /** duration-<name>: "150ms", ease-<name>: "cubic-bezier(0.2, 0, 0, 1)". */
  motion: Record<string, string>
}

export function readDesign(file = join(ROOT, 'DESIGN.md')): Design {
  const text = readFileSync(file, 'utf8')
  const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1]
  if (!front) throw new Error(`${file} has no YAML front matter`)
  const raw = parse(front) as Partial<Design>
  const resolve = (value: unknown, depth = 0): unknown => {
    if (typeof value !== 'string') return value
    const ref = /^\{([\w.-]+)\}$/.exec(value)?.[1]
    if (!ref || depth > 10) return value
    const target = ref.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], raw)
    return resolve(target, depth + 1)
  }
  const colors = Object.fromEntries(Object.entries(raw.colors ?? {}).map(([k, v]) => [k, String(resolve(v))]))
  return {
    name: raw.name ?? '',
    colors,
    typography: raw.typography ?? {},
    rounded: raw.rounded ?? {},
    spacing: raw.spacing ?? {},
    components: raw.components ?? {},
    motion: Object.fromEntries(Object.entries(raw.motion ?? {}).map(([k, v]) => [k, String(v)])),
  }
}

/** The page columns DESIGN.md names (spacing tokens column-narrow, column-wide, …), in px: a page that is not full width takes one of them (check: column-width). */
export function columnWidths(design = readDesign()): number[] {
  return Object.entries(design.spacing)
    .filter(([k]) => k.startsWith('column-'))
    .map(([, v]) => (String(v).trim().endsWith('rem') ? parseFloat(String(v)) * 16 : parseFloat(String(v))))
    .filter((n) => Number.isFinite(n) && n > 0)
}

/** The durations DESIGN.md's motion names, in ms (for check: a transition of any other length is a warning). */
export function motionDurations(design = readDesign()): number[] {
  return Object.entries(design.motion)
    .filter(([k]) => k.startsWith('duration-'))
    .map(([, v]) => (v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000))
    .filter((n) => Number.isFinite(n))
}

/**
 * The themes screens must work in (their data-theme values): the config's, or DESIGN.md's own, where the plain
 * colours are the dark theme and light-* colours make a light one.
 */
export function designThemes(): string[] {
  if (config.themes?.length) return config.themes
  try {
    return Object.keys(readDesign().colors).some((k) => k.startsWith('light-')) ? ['dark', 'light'] : ['dark']
  } catch {
    return ['dark']
  }
}

/** Convert a CSS length from DESIGN.md to pixels. CSS rem uses the 16px root; em and percentages use `relative`. */
function cssLength(value: string | number | undefined, relative: number, unitless: 'px' | 'relative'): number {
  if (value === undefined || value === null) return 0
  if (typeof value === 'number') return unitless === 'relative' ? value * relative : value
  const match = /^(-?(?:\d+|\d*\.\d+))\s*(px|rem|em|%)?$/i.exec(value.trim())
  if (!match) return 0
  const n = Number(match[1])
  switch ((match[2] ?? '').toLowerCase()) {
    case 'rem':
      return n * 16
    case 'em':
    case '%':
      return n * relative * (match[2] === '%' ? 0.01 : 1)
    case 'px':
      return n
    default:
      return unitless === 'relative' ? n * relative : n
  }
}

/** Keep an authored font stack intact, quoting only a single family whose name needs it. */
export function cssFontStack(value: string | undefined): string {
  const stack = value?.trim() ?? ''
  if (!stack) return ''
  if (stack.includes(',') || /^['"].*['"]$/.test(stack) || /^[\w-]+$/.test(stack) || /^var\(/i.test(stack))
    return stack
  return `"${stack.replaceAll('"', '\\"')}"`
}

/** A type level in pixels, for comparing with computed styles. */
export interface Level {
  name: string
  mono: boolean
  size: number
  weight: number
  lineHeight: number
  tracking: number
  /** The first family of the level's font stack, the one the level means. */
  family?: string
}

export function typeLevels(design = readDesign()): Level[] {
  return Object.entries(design.typography).map(([name, t]) => {
    const size = cssLength(t.fontSize, 16, 'px')
    const lineHeightValue = t.lineHeight
    const lineHeight =
      typeof lineHeightValue === 'string' && lineHeightValue.trim().toLowerCase() === 'normal'
        ? size * 1.2
        : cssLength(lineHeightValue, size, 'relative')
    return {
      name,
      mono: /mono/i.test(t.fontFamily ?? ''),
      family: (t.fontFamily ?? '').split(',')[0]?.replaceAll(/["']/g, '').trim() || undefined,
      size,
      weight: Number(t.fontWeight ?? 400),
      lineHeight,
      tracking: cssLength(t.letterSpacing, size, 'px'),
    }
  })
}
