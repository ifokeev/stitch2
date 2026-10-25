/**
 * The pair the app commands work on: an approved screen and its live page, open side by side at the same width.
 * compare, look and geometry all start here, so a route, its sign-in and its prepare script mean the same in each.
 *
 *   "app": {
 *     "url": "http://localhost:4321",
 *     "signIn": "design/app/sign-in.mjs",          // export default async ({ page, url }) => { … }
 *     "routes": {
 *       "home": "/app",
 *       "exercise-detail": { "path": "/app/library", "prepare": "design/app/open-exercise.mjs" },
 *       "sign-in": { "path": "/login", "signedOut": true }   // a page of its own, never signed in
 *     }
 *   }
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, type Page } from '@playwright/test'
import { BASE, checkWidths, config } from './config.ts'
import { listScreens, type Screen } from './screens.ts'
import { startServer } from './serve.ts'

export type Route = string | { path: string; prepare?: string; signedOut?: boolean }

export interface Opened {
  /** The approved version, served by the lab. */
  design: Page
  /** The app page, signed in (or not, for a signedOut route) and prepared. */
  live: Page
  /** The app page's address. */
  url: string
  /** Set when the route's prepare script threw: the page is open, but not in the state the screen draws. */
  prepareError?: string
}

export interface Live {
  /** The approved versions that have a route, narrowed to the screens named on the command line. */
  versions: Screen[]
  /** Screens with an approved version and no route: not compared at all. */
  unmapped: string[]
  /** The app's address from the config. */
  appUrl: string
  /** Opens a version and its app page at the width the version is drawn at, and runs the route's prepare script. */
  open(version: Screen): Promise<Opened>
  /** Resizes the pages that are open to another width; the layout reflows and the prepared state stays. */
  resize(width: number): Promise<void>
  close(): Promise<void>
}

const load = async (file: string) =>
  (await import(pathToFileURL(resolve(BASE, file)).href)).default as (o: { page: Page; url: string }) => Promise<void>

/** Waits for the network to go quiet, then a little longer for what scripts draw after that. */
export const settle = async (page: Page) => {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(800)
}

/** The viewport height a width is drawn at: a phone is taller than a window. */
export const heightAt = (width: number) => (width > 700 ? 800 : 844)

/**
 * The widths a version is looked at: the width it is drawn at, both ends of its variant's range and every breakpoint
 * inside it (the widths check renders). --width narrows them to the ones asked for, --drawn to the width each version
 * is drawn at.
 */
export function widthsFor(s: Pick<Screen, 'width' | 'device'>, args: string[] = []): number[] {
  const only = widthArgs(args)
  if (only.length) return only
  if (args.includes('--drawn')) return [s.width]
  return [...new Set([s.width, ...checkWidths(s.device)])].sort((a, b) => a - b)
}

/** The numbers after --width (360,1280 or two flags), for widthsFor. */
export function widthArgs(args: string[]): number[] {
  const out: number[] = []
  for (const [i, a] of args.entries())
    if (a === '--width' || a.startsWith('--width='))
      for (const v of (a.includes('=') ? a.split('=')[1]! : (args[i + 1] ?? '')).split(','))
        if (Number(v) > 0) out.push(Number(v))
  return out
}

/** The screens named on the command line: the words that are neither flags nor the value of --width. */
export function screenArgs(args: string[]): string[] {
  return args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--width')
}

/**
 * Walks a page from top to bottom and back, so what loads on scroll is there when it is measured, and takes the pointer
 * off the page: a prepare script that clicked something leaves it there, and after a resize a button can end up under it
 * and be measured in its hover colours.
 */
export async function scrollThrough(page: Page) {
  await page.mouse.move(-1, -1)
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(300)
}

/**
 * Starts the lab server and a browser, signs in to the app and returns the pair opener. Exits with a message when the
 * config has no "app" section; `command` names the command in it.
 */
export async function openLive(command: string, only: string[], scale = 1): Promise<Live> {
  const app = config.app
  if (!app?.url || !app.routes) {
    console.error(`stitch2 ${command}: add an "app" section with "url" and "routes" to stitch2.config.json`)
    process.exit(1)
  }
  const routeOf = (screen: string): { path: string; prepare?: string; signedOut?: boolean } | undefined => {
    const r = app.routes[screen] as Route | undefined
    return typeof r === 'string' ? { path: r } : r
  }
  const all = listScreens()
  const versions = all.filter(
    (s) => s.kind === 'screen' && s.status === 'approved' && routeOf(s.screen) && (!only.length || only.includes(s.screen)),
  )
  const unmapped = [...new Set(all.filter((s) => s.status === 'approved' && !routeOf(s.screen)).map((s) => s.screen))]

  const server = await startServer(0)
  const browser = await chromium.launch()
  const context = await browser.newContext({ deviceScaleFactor: scale })
  const signIn = await context.newPage()
  if (app.signIn) await (await load(app.signIn))({ page: signIn, url: app.url })
  await signIn.close()
  const design = await browser.newPage({ deviceScaleFactor: scale })
  const signedIn = await context.newPage()
  // Sign-in and other public pages often redirect a signed-in visitor, so they get a context of their own.
  const signedOut = await (await browser.newContext({ deviceScaleFactor: scale })).newPage()
  let current: Page = signedIn

  return {
    versions,
    unmapped,
    appUrl: app.url,
    async open(s) {
      const route = routeOf(s.screen)!
      const live = route.signedOut ? signedOut : signedIn
      current = live
      const url = new URL(route.path, app.url).href
      for (const p of [design, live]) await p.setViewportSize({ width: s.width, height: heightAt(s.width) })
      await design.goto(`http://127.0.0.1:${server.port}/${s.path}`).catch(() => {})
      await settle(design)
      await live.goto(url).catch(() => {})
      await settle(live)
      let prepareError: string | undefined
      if (route.prepare) {
        // A failing prepare is this version's error; the run goes on with the others.
        try {
          await (await load(route.prepare))({ page: live, url: app.url })
        } catch (e) {
          prepareError = `${route.prepare} failed: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`
        }
        await settle(live)
      }
      return { design, live, url, ...(prepareError ? { prepareError } : {}) }
    },
    async resize(width) {
      for (const p of [design, current]) await p.setViewportSize({ width, height: heightAt(width) })
      await current.waitForTimeout(500)
    },
    async close() {
      await browser.close()
      server.close()
    },
  }
}
