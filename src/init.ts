/**
 * Writes a complete DESIGN.md from a few choices (the way Stitch builds a design system from a theme):
 *   stitch2 init --name "Acme Fit" --primary "#2F6FEB" [--mood "…"] [--modes dark,light] [--sans Inter]
 *     [--mono "JetBrains Mono"] [--base 15] [--roundness 16] [--page 16] [--icons Lucide]
 *     [--scheme tonal_spot|neutral|fidelity|vibrant|expressive|content|monochrome] [--out <file>] [--force]
 * Then refine the prose with the brand's specifics, and run stitch2 lint and stitch2 tokens.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { buildDesignMd, type Choices, contrast, type Mode, palette } from './build-design.ts'
import { ROOT } from './config.ts'

export function parseArgs(argv: string[]) {
  const out: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (!a.startsWith('--')) continue
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true
    else {
      out[a.slice(2)] = next
      i++
    }
  }
  return out
}

export function choicesFrom(a: Record<string, string | true>, defaults: Partial<Choices> = {}): Choices {
  const str = (k: string, d: string) => (typeof a[k] === 'string' ? (a[k] as string) : d)
  const num = (k: string, d: number) => (typeof a[k] === 'string' ? Number(a[k]) : d)
  const primary = str('primary', defaults.primary ?? '#2F6FEB')
  if (!/^#[0-9a-f]{6}$/i.test(primary)) throw new Error(`--primary must be a #rrggbb colour, got ${primary}`)
  return {
    name: str('name', defaults.name ?? 'My app'),
    mood: str('mood', defaults.mood ?? 'A focused, calm app that gets out of the way.'),
    primary,
    modes: str('modes', (defaults.modes ?? ['dark', 'light']).join(','))
      .split(',')
      .map((m) => m.trim()) as Mode[],
    sans: str('sans', defaults.sans ?? 'Inter'),
    mono: typeof a.mono === 'string' ? a.mono : defaults.mono,
    base: num('base', defaults.base ?? 15),
    roundness: num('roundness', defaults.roundness ?? 16),
    page: num('page', defaults.page ?? 16),
    icons: str('icons', defaults.icons ?? 'Lucide'),
    scheme: str('scheme', defaults.scheme ?? 'tonal_spot'),
    levels: defaults.levels,
    colorOverrides: defaults.colorOverrides,
  }
}

/** Writes the file and prints the contrast of the pairs that matter. */
export function writeDesign(c: Choices, a: Record<string, string | true>) {
  const out = resolve(typeof a.out === 'string' ? a.out : join(ROOT, 'DESIGN.md'))
  if (existsSync(out) && !a.force) {
    console.error(`${out} exists; pass --force to replace it, or --out to write elsewhere`)
    process.exit(1)
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, buildDesignMd(c))
  const tokens = join(dirname(out), 'tokens.config.json')
  if (!existsSync(tokens))
    writeFileSync(tokens, `${JSON.stringify({ seed: 'primary', scheme: c.scheme, contrast: 0 }, null, 2)}\n`)
  console.log(`wrote ${out}`)
  for (const m of c.modes) {
    const p = palette(c, m)
    if (p.primary.toLowerCase() !== c.primary.toLowerCase())
      console.log(
        `  ${m}: primary adjusted from ${c.primary} to ${p.primary} so it and its label reach 4.5:1`,
      )
    const pairs: [string, string, string][] = [
      ['text on surface', p.text, p.surface],
      ['text-muted on raised', p['text-muted'], p.raised],
      ['on-primary on primary', p['on-primary'], p.primary],
      ['primary on surface', p.primary, p.surface],
      ['danger on raised', p.danger, p.raised],
    ]
    console.log(`  ${m}: ${pairs.map(([n, f, b]) => `${n} ${contrast(f, b).toFixed(1)}:1`).join(' · ')}`)
  }
  console.log('next: refine the prose (brand, voice, components), then stitch2 lint and stitch2 tokens')
}

if (/init\.[jt]s$/.test(process.argv[1] ?? '')) {
  const a = parseArgs(process.argv.slice(2))
  writeDesign(choicesFrom(a), a)
}
