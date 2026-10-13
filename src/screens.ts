import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { config, ROOT } from './config.ts'

export { ROOT }
/** A lab meta tag name: <prefix>-screen, <prefix>-status… (the prefix comes from the config). */
export const tag = (name: string) => `${config.prefix}-${name}`

export type Status = 'draft' | 'review' | 'approved' | 'archived'
export const STATUSES: Status[] = ['draft', 'review', 'approved', 'archived']

export interface Screen {
  /** Path under design/, e.g. "stitch/home.html" — also the URL path on the lab server. */
  path: string
  /** The folder, e.g. "stitch" or "screens/home". */
  group: string
  /** File name without .html. */
  name: string
  title: string
  /** Frame width in px: <meta name="<prefix>-frame-width" content="390">, default 390 (phone). */
  width: number
  mtime: number
  /** "screen", or "components" for the component catalog. */
  kind: 'screen' | 'components'
  /** Which app screen this file is a version of (<meta name="<prefix>-screen">), e.g. "home". */
  screen: string
  /**
   * The page it belongs to (<meta name="<prefix>-page">): one place in the app whose states and steps are screens of
   * their own, e.g. "workout" for workout, workout-entry and workout-menu. A screen's latest version that names one
   * decides it for all of its versions; without one a screen is its own page.
   */
  page: string
  device: 'mobile' | 'desktop'
  /** Where the version came from: stitch, lab or trial. */
  source: 'stitch' | 'lab' | 'trial'
  /** Short version label: "v3", "Stitch", "Trial 2". */
  version: string
  status: Status
  /** The reviewer's note (<meta name="<prefix>-note">). */
  note: string
}

function* htmlFiles(dir: string): Generator<string> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('_') || e.name.startsWith('.') || e.name === 'assets') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* htmlFiles(p)
    else if (e.name.endsWith('.html')) yield p
  }
}

export const meta = (html: string, name: string) =>
  new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i').exec(html)?.[1]

export function listScreens(): Screen[] {
  const out: Screen[] = []
  const under = (path: string, dir: string) => path.startsWith(`${dir}/`)
  for (const dir of config.screenDirs) {
    for (const file of htmlFiles(join(ROOT, dir))) {
      const html = readFileSync(file, 'utf8')
      const path = relative(ROOT, file)
      const name = path
        .split('/')
        .pop()!
        .replace(/\.html$/, '')
      const group = relative(ROOT, join(file, '..'))
      const width = Number(meta(html, tag('frame-width')) ?? 390)
      const archive = config.archiveDirs.find((d) => under(path, d))
      const source = (meta(html, tag('source')) ??
        (under(path, config.stitchDir) ? 'stitch' : archive ? 'trial' : 'lab')) as Screen['source']
      // design/screens/<screen>/<device>-v<N>.html, or older files named after the screen.
      const versioned = /^(mobile|desktop)-v(\d+)$/.exec(name)
      out.push({
        path,
        group,
        name,
        title: /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '',
        width,
        mtime: statSync(file).mtimeMs,
        kind: under(path, config.catalogDir) ? 'components' : 'screen',
        screen: meta(html, tag('screen')) ?? (versioned ? group.split('/').pop()! : name),
        page: meta(html, tag('page')) ?? '',
        device: (meta(html, tag('device')) ??
          (versioned?.[1] || (width >= 768 ? 'desktop' : 'mobile'))) as Screen['device'],
        source,
        version:
          meta(html, tag('version')) ??
          (versioned
            ? `v${versioned[2]}`
            : source === 'stitch'
              ? 'Stitch'
              : (archive?.split('/').pop() ?? 'v1')),
        status: (meta(html, tag('status')) ?? (archive ? 'archived' : 'review')) as Status,
        note: meta(html, tag('note'))?.replaceAll('&quot;', '"').replaceAll('&amp;', '&') ?? '',
      })
    }
  }
  // One page per screen: the latest version that names one.
  const pages = new Map<string, string>()
  for (const s of [...out].sort((a, b) => versionNumber(b) - versionNumber(a) || b.mtime - a.mtime))
    if (s.page && !pages.has(s.screen)) pages.set(s.screen, s.page)
  for (const s of out) s.page = pages.get(s.screen) ?? s.screen
  return out
}

/** What a screen is within its page: its name without the page's ("entry" for workout-entry), or "main". */
export const stateOf = (s: Pick<Screen, 'screen' | 'page'>) =>
  s.screen === s.page ? 'main' : s.screen.startsWith(`${s.page}-`) ? s.screen.slice(s.page.length + 1) : s.screen

/** Sets (or removes, with undefined) <prefix>-* meta tags in a screen file, keeping the rest of it untouched. */
export function writeMeta(path: string, values: Record<string, string | undefined>) {
  const file = join(ROOT, path)
  let html = readFileSync(file, 'utf8')
  for (const [name, value] of Object.entries(values)) {
    const re = new RegExp(`[ \\t]*<meta\\s+name="${name}"\\s+content="[^"]*"\\s*/?>\\n?`, 'i')
    html = html.replace(re, '')
    if (value === undefined || value === '') continue
    const tag = `<meta name="${name}" content="${value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('\n', ' ')}" />\n`
    html = /<head[^>]*>\n?/i.test(html)
      ? html.replace(/<head[^>]*>\n?/i, (m) => `${m.endsWith('\n') ? m : `${m}\n`}${tag}`)
      : tag + html
  }
  writeFileSync(file, html)
}

/**
 * Approves a variant. Approval makes it the one current version of its screen on its device: every earlier
 * version there (approved, in review or a draft) and any other approved one become archived, so nobody can mistake
 * an older one for what is implemented. Later versions (a newer proposal) keep their status.
 * Returns the variants it archived.
 */
export function approve(path: string): Screen[] {
  const all = listScreens()
  const target = all.find((s) => s.path === path)
  if (!target || target.kind !== 'screen') throw new Error(`not a screen: ${path}`)
  writeMeta(path, { [tag('status')]: 'approved' })
  const n = versionNumber(target)
  const outdated = all.filter(
    (s) =>
      s.path !== path &&
      s.kind === 'screen' &&
      s.screen === target.screen &&
      s.device === target.device &&
      s.status !== 'archived' &&
      (s.status === 'approved' || versionNumber(s) < n),
  )
  for (const s of outdated) writeMeta(s.path, { [tag('status')]: 'archived' })
  return outdated
}

/**
 * What makes it unclear which version of a screen is current: two approved on one device, or an earlier version
 * still in review or a draft next to an approved later one. One line each; empty when every screen is clear.
 */
export function versionProblems(screens: Screen[] = listScreens()): string[] {
  const out: string[] = []
  const groups = new Map<string, Screen[]>()
  for (const s of screens) {
    if (s.kind !== 'screen' || s.status === 'archived') continue
    const key = `${s.screen} ${s.device}`
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  for (const [key, list] of groups) {
    const approved = list.filter((s) => s.status === 'approved')
    if (approved.length > 1)
      out.push(`${key}: ${approved.map((s) => s.version).join(' and ')} are all approved; approve the current one again`)
    const current = Math.max(...approved.map(versionNumber).filter((n) => !Number.isNaN(n)))
    for (const s of list)
      if (s.status !== 'approved' && versionNumber(s) < current)
        out.push(`${key}: ${s.version} is still ${s.status} although v${current} is approved; archive it (${s.path})`)
  }
  return out.sort()
}

/** A version's number: 3 for "v3"; NaN for one without (a Stitch export, a trial). */
export const versionNumber = (s: Pick<Screen, 'version'>) => Number(/^v(\d+)$/.exec(s.version)?.[1] ?? Number.NaN)
