/**
 * Sandboxes: isolated folders where fresh agents design from a brief without seeing the project's other
 * versions, so their work is not anchored to what exists ("fresh eyes"), and where changes to the skills can
 * be tested on output that only the rules produced.
 *
 *   stitch2 sandbox create <dir> <brief.md>… [--device mobile|desktop] [--context <screen>…]
 *     The project's config, its design folder without screens (DESIGN.md, tokens, components, the catalog and
 *     templates), the skills from the config, a copy of stitch2 and the briefs (one screen each, named after the
 *     file). --context adds the approved versions of other screens, to stay consistent with them.
 *   stitch2 sandbox import <dir> [--label "…"]
 *     Brings every screen designed there back as the next version of its screen, status review, with a note
 *     saying where it came from.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { BASE, CONFIG_NAME, config, type LabConfig } from './config.ts'
import { listScreens, meta, ROOT, tag, writeMeta } from './screens.ts'

const argv = process.argv.slice(2)
const sub = argv[0] === 'create' || argv[0] === 'import' ? argv.shift()! : 'create'
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  if (i < 0) return undefined
  const values: string[] = []
  for (let j = i + 1; j < argv.length && !argv[j]!.startsWith('--'); j++) values.push(argv[j]!)
  argv.splice(i, values.length + 1)
  return values
}
const appDir = (c: LabConfig) => c.screenDirs.filter((d) => d !== c.stitchDir).at(-1) ?? 'screens'

if (sub === 'create') {
  const device = flag('device')?.[0] ?? 'mobile'
  const context = flag('context') ?? []
  const [dir, ...briefs] = argv
  if (!dir || !briefs.length) {
    console.error(
      'usage: stitch2 sandbox create <dir> <brief.md>… [--device mobile|desktop] [--context <screen>…]',
    )
    process.exit(1)
  }
  const out = resolve(dir)
  if (existsSync(out) && readdirSync(out).length) {
    console.error(`${out} is not empty`)
    process.exit(1)
  }
  const lab = new URL('..', import.meta.url).pathname
  // The design folder minus every screen, except the catalog and templates (files starting with _).
  const generated = new Set(['renders', 'checks.json', 'type-audit.json', 'consistency'])
  cpSync(ROOT, join(out, 'design'), {
    recursive: true,
    filter: (src) => {
      const rel = relative(ROOT, src)
      if (!rel) return true
      if (
        generated.has(rel.split('/')[0]!) ||
        config.sandboxExclude?.some((x) => rel === x || rel.startsWith(`${x}/`))
      )
        return false
      const screenDir = config.screenDirs.find((d) => rel === d || rel.startsWith(`${d}/`))
      if (!screenDir || rel === screenDir) return true
      if (
        rel === config.catalogDir ||
        rel.startsWith(`${config.catalogDir}/`) ||
        config.catalogDir.startsWith(`${rel}/`)
      )
        return true
      return basename(rel).startsWith('_')
    },
  })
  // Approved versions of the context screens (never of the screens being designed).
  const designing = new Set(briefs.map((b) => basename(b).replace(/\.md$/, '')))
  const copied = listScreens().filter(
    (s) => s.status === 'approved' && context.includes(s.screen) && !designing.has(s.screen),
  )
  for (const s of copied) {
    mkdirSync(dirname(join(out, 'design', s.path)), { recursive: true })
    cpSync(join(ROOT, s.path), join(out, 'design', s.path))
    const assets = join(ROOT, dirname(s.path), 'assets')
    if (existsSync(assets))
      cpSync(assets, join(out, 'design', dirname(s.path), 'assets'), { recursive: true })
  }
  // Skills are often symlinks into a package; dereference so nothing points back out of the sandbox.
  for (const s of config.skills)
    cpSync(resolve(BASE, s), join(out, s), { recursive: true, dereference: true })
  writeFileSync(
    join(out, CONFIG_NAME),
    `${JSON.stringify({ ...config, designDir: 'design', screenDirs: config.screenDirs.filter((d) => d !== config.stitchDir), archiveDirs: [] }, null, 2)}\n`,
  )
  cpSync(join(lab, 'src'), join(out, 'stitch2/src'), { recursive: true })
  cpSync(join(lab, 'package.json'), join(out, 'stitch2/package.json'))
  symlinkSync(join(lab, 'node_modules'), join(out, 'stitch2/node_modules'))
  mkdirSync(join(out, 'briefs'), { recursive: true })
  for (const b of briefs) cpSync(resolve(b), join(out, 'briefs', basename(b)))
  const p = config.prefix
  const target = (name: string) => `design/${appDir(config)}/${name}/${device}-v1.html`
  writeFileSync(
    join(out, 'AGENTS.md'),
    `# Design sandbox

This folder is the whole project for this task. Read and write files only inside it; do not open anything
outside it (no other checkouts, no git history, no web searches for this project's existing screens). Fetching
public design guides listed in the skills is fine.

- Skills: ${config.skills.map((s) => `${s}/SKILL.md`).join(', ')} (follow their workflow)
- Design system: design/DESIGN.md, with its generated tokens next to it; components in the catalog,
  design/${config.catalogDir}${copied.length ? `\n- Approved screens to stay consistent with: ${copied.map((s) => `design/${s.path}`).join(', ')}` : ''}
- Briefs, one screen each: ${briefs.map((b) => `briefs/${basename(b)} → ${target(basename(b).replace(/\.md$/, ''))}`).join('; ')}.
  Start from the template in design/${appDir(config)}/; set <meta name="${p}-screen"> to the brief's name,
  ${p}-device to ${device} and ${p}-status to review when done.
- stitch2, from this folder: node stitch2/src/cli.ts check --shots once, then node stitch2/src/cli.ts check
  <path> --shots --strict (renders in design/renders/), node stitch2/src/cli.ts type <path>,
  node stitch2/src/cli.ts canvas (PORT=4410)
`,
  )
  writeFileSync(
    join(out, 'sandbox.json'),
    `${JSON.stringify({ project: BASE, created: new Date().toISOString(), device, briefs: briefs.map((b) => basename(b)), context: copied.map((s) => s.path) }, null, 2)}\n`,
  )
  console.log(
    `sandbox ready: ${out} (${briefs.length} brief(s)${copied.length ? `, ${copied.length} approved screen(s) for context` : ''})`,
  )
  console.log(`  run a fresh agent there (no shared conversation), then: stitch2 sandbox import ${out}`)
} else {
  const label = flag('label')?.join(' ')
  const [dir] = argv
  if (!dir) {
    console.error('usage: stitch2 sandbox import <dir> [--label "…"]')
    process.exit(1)
  }
  const box = resolve(dir)
  const boxConfig = JSON.parse(readFileSync(join(box, CONFIG_NAME), 'utf8')) as LabConfig
  const boxRoot = join(box, boxConfig.designDir)
  const files: string[] = []
  const walk = (d: string) => {
    if (!existsSync(d)) return
    for (const e of readdirSync(d)) {
      const f = join(d, e)
      if (statSync(f).isDirectory()) {
        if (e !== 'assets') walk(f)
      } else if (e.endsWith('.html') && !e.startsWith('_')) files.push(f)
    }
  }
  for (const d of boxConfig.screenDirs) walk(join(boxRoot, d))
  const versions = listScreens()
  const next = (screen: string, device: string) => {
    const taken = versions
      .filter((s) => s.screen === screen && s.device === device)
      .map((s) => Number(/^v(\d+)$/.exec(s.version)?.[1] ?? 1))
    return Math.max(0, ...taken) + 1
  }
  let imported = 0
  for (const f of files) {
    const rel = relative(boxRoot, f)
    if (rel.startsWith(`${boxConfig.catalogDir}/`)) continue
    const html = readFileSync(f, 'utf8')
    if (meta(html, tag('status')) === 'approved') continue // context copied in from the project
    const screen = meta(html, tag('screen')) ?? basename(dirname(f))
    const device = meta(html, tag('device')) ?? 'mobile'
    const n = next(screen, device)
    const path = `${appDir(config)}/${screen}/${device}-v${n}.html`
    mkdirSync(dirname(join(ROOT, path)), { recursive: true })
    cpSync(f, join(ROOT, path))
    const assets = join(dirname(f), 'assets')
    if (existsSync(assets)) cpSync(assets, join(ROOT, dirname(path), 'assets'), { recursive: true })
    writeMeta(path, {
      [tag('screen')]: screen,
      [tag('device')]: device,
      [tag('status')]: 'review',
      [tag('source')]: 'lab',
      [tag('note')]:
        `Fresh-eyes version from sandbox ${basename(box)}${label ? ` (${label})` : ''}: designed without seeing the other versions.`,
    })
    versions.push({ ...versions[0]!, screen, device: device as 'mobile' | 'desktop', version: `v${n}` })
    console.log(`  ${screen} ${device} v${n} (${config.designDir}/${path})`)
    imported++
  }
  console.log(`imported ${imported} screen(s) from ${box}; review them on the canvas`)
}
