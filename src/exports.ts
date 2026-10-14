/**
 * Token exports: DESIGN.md's tokens written for the app, so the product and the canvas share one source. Listed
 * in stitch2.config.json under "exports" and written by stitch2 tokens:
 *   css        CSS variables for both themes and the .type-<level> classes
 *   tailwind4  the same, plus an @theme block (bg-<colour>, rounded-<name>, font-sans) and the type levels as
 *              @utility type-<level>, for a Tailwind v4 stylesheet to @import. Spacing stays out of @theme:
 *              names like lg or 2xl would also resize max-w-lg and friends; it is --<prefix>-spacing-<name>.
 *              Motion: ease-<name> classes, duration-<name> utilities, and Tailwind's default transition (the
 *              plain transition, transition-colors…) set to the first duration and ease-standard.
 *   dtcg       W3C Design Tokens JSON, for Style Dictionary and other platforms (iOS, Android)
 * css and tailwind4 also carry the pointer rule (POINTER): every enabled control shows the hand cursor, a disabled
 * one shows not-allowed. Tailwind v4's preflight gives buttons the arrow, so without it nothing looks clickable.
 * "aliases" maps the app's own variable names to DESIGN.md colours ({ "background": "floor" } writes
 * --background: var(--<prefix>-floor) in each theme), so an existing theme (shadcn's, say) keeps its names.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { BASE, config } from './config.ts'
import type { Design } from './design-md.ts'

export interface TokenExport {
  format: 'css' | 'tailwind4' | 'dtcg'
  /** Output file, relative to stitch2.config.json. */
  path: string
  /** App variable name → DESIGN.md colour name (or any CSS value). */
  aliases?: Record<string, string>
  /** Theme selectors; default the lab's: :root, [data-theme='dark'] and [data-theme='light']. */
  themes?: { dark?: string; light?: string }
}

export interface Tokens {
  design: Design
  dark: Record<string, string>
  light: Record<string, string>
  /** Declarations per type level, e.g. ["font: 600 28px/34px \"Geist\", …", "letter-spacing: -0.03em"]. */
  type: Record<string, string[]>
  /** Extra variables for :root (font fallbacks). */
  root: Record<string, string>
  header: string
}

const p = () => config.prefix

/**
 * The cursor over controls, in @layer base so any utility (cursor-grab, cursor-text) or component rule wins.
 * check reports a catalog control that still shows another cursor (state-cursor, states.ts).
 */
export const POINTER = [
  '/* Every enabled control shows the hand cursor, a disabled one not-allowed (Tailwind v4 gives buttons the arrow). */',
  '@layer base {',
  '  button:not(:disabled), [role="button"]:not([aria-disabled="true"]), [role="switch"]:not([aria-disabled="true"]),',
  '  [role="tab"]:not([aria-disabled="true"]), [role="checkbox"]:not([aria-disabled="true"]),',
  '  [role="radio"]:not([aria-disabled="true"]), [role="option"]:not([aria-disabled="true"]),',
  '  [role="menuitem"]:not([aria-disabled="true"]), summary, select:not(:disabled), label[for],',
  '  input:is([type="checkbox"], [type="radio"], [type="range"], [type="file"], [type="color"], [type="submit"], [type="button"], [type="reset"]):not(:disabled) {',
  '    cursor: pointer;',
  '  }',
  '  :disabled, [aria-disabled="true"] {',
  '    cursor: not-allowed;',
  '  }',
  '}',
].join('\n')

function themeBlocks(t: Tokens, e: TokenExport): string[] {
  const dark = e.themes?.dark ?? ":root, [data-theme='dark']"
  const light = e.themes?.light ?? "[data-theme='light']"
  const alias = (palette: Record<string, string>) =>
    Object.entries(e.aliases ?? {}).map(([k, v]) => `  --${k}: ${v in palette ? `var(--${p()}-${v})` : v};`)
  const block = (selector: string, palette: Record<string, string>, scheme: string) =>
    [
      `${selector} {`,
      `  color-scheme: ${scheme};`,
      ...Object.entries(palette).map(([k, v]) => `  --${p()}-${k}: ${v};`),
      ...alias(palette),
      '}',
    ].join('\n')
  // The block on :root goes first: a theme class (.dark) has the same specificity and must come later to win.
  const themes = [block(dark, t.dark, 'dark'), block(light, t.light, 'light')]
  if (/:root/.test(light) && !/:root/.test(dark)) themes.reverse()
  const root = { ...t.root, ...Object.fromEntries(Object.entries(t.design.spacing).map(([k, v]) => [`${p()}-spacing-${k}`, v])) }
  return [...themes, `:root {\n${Object.entries(root).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`]
}

function css(t: Tokens, e: TokenExport): string {
  const type = Object.entries(t.type).map(([n, d]) => `.type-${n} { ${d.join('; ')}; }`)
  return [t.header, ...themeBlocks(t, e), ...type, POINTER, ''].join('\n\n')
}

function tailwind4(t: Tokens, e: TokenExport): string {
  const families = Object.values(t.design.typography).map((x) => x.fontFamily ?? '')
  const sans = families.find((f) => !/mono/i.test(f))
  const mono = families.find((f) => /mono/i.test(f))
  const theme = [
    ...Object.keys(t.dark).map((k) => `  --color-${k}: var(--${p()}-${k});`),
    ...Object.entries(t.design.rounded).map(([k, v]) => `  --radius-${k}: ${v};`),
    ...(sans ? [`  --font-sans: "${sans}", var(--${p()}-font-sans-fallback);`] : []),
    ...(mono ? [`  --font-mono: "${mono}", var(--${p()}-font-mono-fallback);`] : []),
    ...motionTheme(t.design.motion),
  ]
  const type = Object.entries(t.type).map(([n, d]) => `@utility type-${n} {\n${d.map((x) => `  ${x};`).join('\n')}\n}`)
  const durations = Object.keys(t.design.motion)
    .filter((k) => k.startsWith('duration-'))
    .map((k) => `@utility ${k} {\n  transition-duration: var(--${p()}-${k});\n  animation-duration: var(--${p()}-${k});\n}`)
  return [t.header, ...themeBlocks(t, e), `@theme inline {\n${theme.join('\n')}\n}`, ...type, ...durations, POINTER, ''].join('\n\n')
}

/** @theme entries for motion: --ease-<name> (Tailwind's ease-* classes) and the default transition. */
function motionTheme(motion: Record<string, string>): string[] {
  const keys = Object.keys(motion)
  const eases = keys.filter((k) => k.startsWith('ease-'))
  const first = keys.includes('duration-short') ? 'duration-short' : keys.find((k) => k.startsWith('duration-'))
  const standard = eases.find((k) => k === 'ease-standard') ?? eases[0]
  return [
    ...eases.map((k) => `  --${k}: var(--${p()}-${k});`),
    ...(first ? [`  --default-transition-duration: var(--${p()}-${first});`] : []),
    ...(standard ? [`  --default-transition-timing-function: var(--${p()}-${standard});`] : []),
  ]
}

function dtcg(t: Tokens): string {
  const group = (type: string, o: Record<string, string>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { $type: type, $value: v }]))
  const typography = Object.fromEntries(
    Object.entries(t.design.typography).map(([k, v]) => [
      k,
      {
        $type: 'typography',
        $value: {
          fontFamily: v.fontFamily,
          fontSize: v.fontSize,
          fontWeight: Number(v.fontWeight ?? 400),
          lineHeight: v.lineHeight,
          letterSpacing: v.letterSpacing ?? '0em',
        },
      },
    ]),
  )
  return `${JSON.stringify(
    {
      $description: t.header.replace(/^\/\* | \*\/$/g, ''),
      color: group('color', t.dark),
      'color-light': group('color', t.light),
      radius: group('dimension', t.design.rounded),
      spacing: group('dimension', t.design.spacing),
      ...(Object.keys(t.design.motion).length
        ? {
            duration: group('duration', Object.fromEntries(Object.entries(t.design.motion).filter(([k]) => k.startsWith('duration-')).map(([k, v]) => [k.slice(9), v]))),
            easing: Object.fromEntries(
              Object.entries(t.design.motion)
                .filter(([k]) => k.startsWith('ease-'))
                .map(([k, v]) => [k.slice(5), { $type: 'cubicBezier', $value: (v.match(/-?[\d.]+/g) ?? []).map(Number) }]),
            ),
          }
        : {}),
      typography,
    },
    null,
    2,
  )}\n`
}

/** Writes every export in the config; returns their paths. */
export function writeExports(t: Tokens, list: TokenExport[] = config.exports ?? []): string[] {
  return list.map((e) => {
    const file = resolve(BASE, e.path)
    const body = e.format === 'css' ? css(t, e) : e.format === 'tailwind4' ? tailwind4(t, e) : e.format === 'dtcg' ? dtcg(t) : null
    if (body === null) throw new Error(`unknown export format "${e.format}"; use css, tailwind4 or dtcg`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, body)
    return e.path
  })
}
