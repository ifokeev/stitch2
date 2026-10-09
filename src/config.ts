/**
 * The lab's settings, from stitch2.config.json: the nearest one above the working directory, or the file in
 * STITCH2_CONFIG. Paths in it are relative to the file. Without a config the lab uses ./design and defaults.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

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
  /** Skill folders a blind-trial sandbox copies. */
  skills: string[]
  /** Paths under designDir a sandbox leaves out besides screens (notes that would give the trial away). */
  sandboxExclude?: string[]
  /** Token files stitch2 tokens also writes for the app (see exports.ts). */
  exports?: {
    format: 'css' | 'tailwind4' | 'dtcg'
    path: string
    aliases?: Record<string, string>
    themes?: { dark?: string; light?: string }
  }[]
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
/** The design folder, with a trailing slash. */
export const ROOT = join(resolve(BASE, config.designDir), '/')
