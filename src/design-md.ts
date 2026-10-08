/**
 * Reads design/DESIGN.md's YAML front matter (the DESIGN.md format: colors, typography, rounded, spacing,
 * components) and resolves {path.to.token} references.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
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
  }
}

/** A type level in pixels, for comparing with computed styles. */
export interface Level {
  name: string
  mono: boolean
  size: number
  weight: number
  lineHeight: number
  tracking: number
}

export function typeLevels(design = readDesign()): Level[] {
  return Object.entries(design.typography).map(([name, t]) => {
    const size = Number.parseFloat(String(t.fontSize))
    const lh = String(t.lineHeight)
    return {
      name,
      mono: /mono/i.test(t.fontFamily ?? ''),
      size,
      weight: Number(t.fontWeight ?? 400),
      lineHeight: lh.endsWith('px') ? Number.parseFloat(lh) : Number.parseFloat(lh) * size,
      tracking: t.letterSpacing?.endsWith('em')
        ? Number.parseFloat(t.letterSpacing) * size
        : Number.parseFloat(t.letterSpacing ?? '0') || 0,
    }
  })
}
