/**
 * Builds an isolated folder for a blind design trial: the project's stitch2 config, its design folder without
 * screens (DESIGN.md, tokens, components, the component catalog and screen templates), the skills listed in the
 * config, a copy of stitch2 and the given briefs. Nothing else: no other screens, no git history, so a
 * designer working there cannot copy existing work.
 * Usage: stitch2 sandbox <dir> <brief.md>…
 *   The designer then runs stitch2 inside it: node stitch2/src/cli.ts check app/<name> --shots
 */
import { cpSync, existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { BASE, CONFIG_NAME, config } from './config.ts'
import { ROOT } from './screens.ts'

const [dir, ...briefs] = process.argv.slice(2)
if (!dir) {
  console.error('usage: stitch2 sandbox <dir> <brief.md>…')
  process.exit(1)
}
const out = resolve(dir)
if (existsSync(out) && readdirSync(out).length) {
  console.error(`${out} is not empty`)
  process.exit(1)
}
const lab = new URL('..', import.meta.url).pathname
const designOut = join(out, 'design')

// The design folder minus every screen, except the catalog and templates (files starting with _).
const generated = new Set(['renders', 'checks.json', 'type-audit.json', 'consistency'])
cpSync(ROOT, designOut, {
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
// dereference: skills are often symlinks into a package, which would point back out of the sandbox.
for (const s of config.skills) cpSync(resolve(BASE, s), join(out, s), { recursive: true, dereference: true })
writeFileSync(
  join(out, CONFIG_NAME),
  `${JSON.stringify({ ...config, designDir: 'design', screenDirs: config.screenDirs.filter((d) => d !== config.stitchDir), archiveDirs: [] }, null, 2)}\n`,
)
cpSync(join(lab, 'src'), join(out, 'stitch2/src'), { recursive: true })
cpSync(join(lab, 'package.json'), join(out, 'stitch2/package.json'))
symlinkSync(join(lab, 'node_modules'), join(out, 'stitch2/node_modules'))
mkdirSync(join(out, 'briefs'), { recursive: true })
for (const b of briefs) cpSync(resolve(b), join(out, 'briefs', basename(b)))
const appDir = config.screenDirs.filter((d) => d !== config.stitchDir).at(-1) ?? 'screens'
writeFileSync(
  join(out, 'AGENTS.md'),
  `# Design trial workspace

This folder is the whole project for this task. Read and write files only inside it; do not open anything
outside it (no other checkouts, no git history, no web searches for this project's existing screens). Fetching
public design guides listed in the skills is fine.

- Skills: ${config.skills.map((s) => `${s}/SKILL.md`).join(', ')} (follow their workflow)
- Design system: design/DESIGN.md, with its generated tokens next to it
- Component catalog: design/${config.catalogDir}
- Briefs: briefs/*.md, one screen each; write each screen to design/${appDir}/app/<brief name>.html
- stitch2, from this folder: node stitch2/src/cli.ts check --shots once (so every screen's components are
  known), then node stitch2/src/cli.ts check app/<name> --shots --strict (renders in design/renders/),
  node stitch2/src/cli.ts type app/<name>, node stitch2/src/cli.ts canvas (PORT=4410)
`,
)
console.log(`sandbox ready: ${out} (${briefs.length} briefs)`)
