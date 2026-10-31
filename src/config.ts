/**
 * The lab's settings, from stitch2.config.json: the nearest one above the working directory, or the file in
 * STITCH2_CONFIG. Paths in it are relative to the file. Without a config the lab uses ./design and defaults.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * An app state every screen can be shown in, picked from the canvas sidebar: signed in or out, a plan, a role. The pick
 * is an attribute on each screen's <html> (data-auth="user"), so the screens' own CSS and scripts answer to it.
 */
export interface ModeConfig {
  /** The id: lowercase letters, digits and hyphens. The canvas remembers the pick under it. */
  name: string
  /** Shown before each value in the dropdown; defaults to the name, capitalized. */
  label?: string
  /** The attribute on the screen's <html> that carries the value; defaults to data-<name>. */
  attribute?: string
  /** What the canvas can show every screen as: a value, or a value with its label. "As drawn" is always offered too. */
  values: (string | { value: string; label?: string })[]
}

export interface LabConfig {
  /** Shown on the canvas. */
  name: string
  /** Folder with DESIGN.md, the generated tokens, components and screens. */
  designDir: string
  /** Folders under designDir that hold screens, in canvas order. */
  screenDirs: string[]
  /** Folder under designDir whose screens are Stitch exports (their source defaults to "stitch"). */
  stitchDir: string
  /** Folders under designDir with past experiments: archived by default, compared only among themselves. */
  archiveDirs: string[]
  /** Folder under designDir with the component catalog screen(s). */
  catalogDir: string
  /**
   * One prefix for everything the lab writes into screens: meta tags (<prefix>-screen, <prefix>-status…),
   * component elements and their marker (<prefix>-button, data-<prefix>) and CSS variables (--<prefix>-…).
   */
  prefix: string
  /** Screen names in canvas order; the rest follow alphabetically. */
  order: string[]
  /** Tap targets smaller than this (px) get a warning; under WCAG's 24px they are errors when crowded. */
  comfortableTarget: number
  /** The numbers behind hint-length, menu-item-size and measure (see RuleLimits); the ones left out keep their defaults. */
  rules?: Partial<RuleLimits>
  /**
   * The themes every screen must work in, by their data-theme value. Defaults to DESIGN.md's: "dark" (the plain
   * colours) and "light" when it has light-* colours. The canvas switches between them; check runs in each.
   */
  themes?: string[]
  /**
   * The window widths each variant covers, [narrowest, widest] in px, by device. A variant is drawn at its frame
   * width; stitch2 check also renders it at both ends of its range, and the canvas can show it there. Defaults
   * follow Google's window size classes: mobile 360–599 (compact), tablet 600–1023 (medium), desktop 1024–1920.
   */
  widths?: Record<string, [number, number]>
  /**
   * WCAG 1.4.10 (reflow): check also narrows every phone-sized screen to 320 CSS px (the width of a desktop window at 400% zoom) and reports what sticks
   * out or scrolls sideways there, as warnings. On by default; false turns it off.
   */
  reflow?: boolean
  /**
   * The window widths where the screens' layouts change (their responsive rules, Tailwind's sm: md: lg: …), in px.
   * check renders each variant at every breakpoint inside its range besides the two ends, and the canvas can show
   * every screen at one of them. Defaults to Tailwind's: sm 640, md 768, lg 1024, xl 1280, 2xl 1536.
   */
  breakpoints?: Record<string, number>
  /** Skill folders a blind-trial sandbox copies. */
  skills: string[]
  /** Paths under designDir a sandbox leaves out besides screens (notes that would give the trial away). */
  sandboxExclude?: string[]
  /**
   * App states shown across all screens (see ModeConfig). The canvas has a dropdown for each, with the screens as drawn
   * first; picking a value sets its attribute on every screen, live ones and the pictures of the rest. stitch2 check also
   * runs each screen in every value its file does not already have, one mode at a time.
   */
  modes?: ModeConfig[]
  /** The live app, for stitch2 compare (see compare.ts): its URL, a sign-in script and a route per screen. */
  app?: {
    url: string
    signIn?: string
    routes: Record<string, string | { path: string; prepare?: string }>
  }
  /** Languages: message files the screens' data-t keys come from (see i18n.ts). */
  i18n?: I18nConfig
  /** Token files stitch2 tokens also writes for the app (see exports.ts). */
  exports?: {
    format: 'css' | 'tailwind4' | 'dtcg'
    path: string
    aliases?: Record<string, string>
    themes?: { dark?: string; light?: string }
  }[]
}

/**
 * The numbers some checks hold a screen to. Each default comes from a published source (named by the check in its skill), and a project whose own
 * rules differ says so in stitch2.config.json under "rules"; the checks report against its numbers, not ours.
 */
export interface RuleLimits {
  /** hint-length: the longest hint under a label, in characters (GOV.UK and Carbon keep it to a short sentence). */
  hintCharacters: number
  /** hint-length: the most lines a hint may take. */
  hintLines: number
  /** menu-item-size: the shortest menu item, in px (Apple's 44; Material and Carbon use 48; WCAG 2.5.8 asks 24). */
  menuItemHeight: number
  /** menu-item-size: the smallest text in a menu item, in px. */
  menuItemText: number
  /** measure: the longest line of prose, in characters, before a warning (45–75 is the target; the extra is the slack of a font). */
  measureLongest: number
}

/** What the checks use when the config names no "rules". audit repeats these in the page (it runs there, with no imports); a test holds the two together. */
export const RULE_DEFAULTS: RuleLimits = { hintCharacters: 90, hintLines: 2, menuItemHeight: 44, menuItemText: 14, measureLongest: 80 }

export interface I18nConfig {
  /** Locales with translations, besides the source language. */
  locales?: string[]
  /** The language screens are written in (default en). */
  source?: string
  /** Where messages live, relative to the config: "src/i18n/{locale}.json", or per locale with "*" as the rest. */
  messages?: string | Record<string, string>
  /** Locales stitch2 check runs besides the pseudo-languages ("all" for every one). */
  check?: string[] | 'all'
  /** Right-to-left locales, if not the usual (ar, he, fa, ur, ps, yi). */
  rtl?: string[]
}

const DEFAULTS: LabConfig = {
  name: 'stitch2',
  designDir: 'design',
  screenDirs: ['screens'],
  stitchDir: 'stitch',
  archiveDirs: [],
  catalogDir: 'screens/components',
  prefix: 's2',
  order: [],
  comfortableTarget: 32,
  skills: [],
}

export const CONFIG_NAME = 'stitch2.config.json'

function find(): string | undefined {
  if (process.env.STITCH2_CONFIG) return resolve(process.env.STITCH2_CONFIG)
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    if (existsSync(join(dir, CONFIG_NAME))) return join(dir, CONFIG_NAME)
    if (dirname(dir) === dir) return undefined
  }
}

export const CONFIG_FILE = find()
/** The folder paths in the config are relative to (the project root). */
export const BASE = CONFIG_FILE ? dirname(CONFIG_FILE) : process.cwd()
export const config: LabConfig = {
  ...DEFAULTS,
  ...(CONFIG_FILE ? (JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Partial<LabConfig>) : {}),
}
/** The widths a variant covers: [narrowest, widest] for its device, from the config or the defaults. */
export const WIDTH_DEFAULTS: Record<string, [number, number]> = { mobile: [360, 599], tablet: [600, 1023], desktop: [1024, 1920] }
export const widthRanges = (): Record<string, [number, number]> => ({ ...WIDTH_DEFAULTS, ...config.widths })
/** The numbers the checks use: the defaults with the project's own on top. */
export const ruleLimits = (): RuleLimits => ({ ...RULE_DEFAULTS, ...config.rules })
export const widthRange = (device: string): [number, number] | undefined => widthRanges()[device]
export const BREAKPOINT_DEFAULTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }
export const breakpoints = (): Record<string, number> => config.breakpoints ?? BREAKPOINT_DEFAULTS
/**
 * The widths check renders a variant at: both ends of its range and every breakpoint inside it, where a responsive
 * rule starts (each one is the narrowest window of its layout, where things are most likely to break).
 */
export function checkWidths(device: string): number[] {
  const range = widthRange(device)
  if (!range) return []
  const inside = Object.values(breakpoints()).filter((b) => b > range[0] && b < range[1])
  return [...new Set([range[0], ...inside, range[1]])].sort((a, b) => a - b)
}
export interface Mode {
  name: string
  label: string
  attribute: string
  values: { value: string; label: string }[]
}
const MODE_NAME = /^[a-z][a-z0-9-]*$/
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** The configured modes, checked: a name or attribute that isn't plain, a repeat, or a mode without values is left out. */
export function modes(): Mode[] {
  const out: Mode[] = []
  for (const m of Array.isArray(config.modes) ? config.modes : []) {
    if (typeof m?.name !== 'string' || !MODE_NAME.test(m.name) || out.some((o) => o.name === m.name)) continue
    const attribute = m.attribute ?? `data-${m.name}`
    if (!MODE_NAME.test(attribute)) continue
    const values: Mode['values'] = []
    for (const v of Array.isArray(m.values) ? m.values : []) {
      const value = typeof v === 'string' ? v : v?.value
      if (typeof value !== 'string' || !value || /[\s"'<>=&:]/.test(value) || values.some((x) => x.value === value)) continue
      values.push({ value, label: (typeof v === 'object' && v.label) || capitalize(value) })
    }
    if (values.length) out.push({ name: m.name, label: m.label ?? capitalize(m.name), attribute, values })
  }
  return out
}
/**
 * The attributes a request asks for, from its "name:value" pairs; a pair that isn't a configured mode and value is
 * ignored, so an address can only set what the config offers.
 */
export function modeAttributes(pairs: string[]): Record<string, string> {
  const picked: Record<string, string> = {}
  for (const pair of pairs) {
    const at = pair.indexOf(':')
    const mode = modes().find((m) => m.name === pair.slice(0, at))
    const value = pair.slice(at + 1)
    if (at > 0 && mode?.values.some((v) => v.value === value)) picked[mode.attribute] = value
  }
  return picked
}
/** The design folder, with a trailing slash. */
export const ROOT = join(resolve(BASE, config.designDir), '/')
