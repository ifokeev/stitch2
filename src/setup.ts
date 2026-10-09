/**
 * Sets a project up for stitch2 in one step, for people and agents alike:
 *   stitch2 setup [--name "My app" --primary "#2F6FEB" [init options]] [--prefix ma] [--skills-dir .agents/skills,…]
 * Links stitch2's skills into the agent's skills folder(s), writes stitch2.config.json, a screen template, a
 * component catalog and a few starter components (light-DOM custom elements on DESIGN.md's tokens), and, with
 * --name and --primary, DESIGN.md and its tokens. Existing files are never overwritten, so it is safe to re-run.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONFIG_FILE, CONFIG_NAME, config as current } from './config.ts'
import { parseArgs } from './init.ts'

const args = parseArgs(process.argv.slice(2))
const str = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : undefined)
const project = process.cwd()
const pkg = fileURLToPath(new URL('..', import.meta.url))
const cli = fileURLToPath(new URL(`./cli${import.meta.url.endsWith('.ts') ? '.ts' : '.js'}`, import.meta.url))
const done: string[] = []
const skipped: string[] = []

/** Writes a file unless it exists; records which. */
function write(file: string, content: string) {
  const path = resolve(project, file)
  if (existsSync(path)) return skipped.push(file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  done.push(file)
}

/** Two letters from the product name ("Acme Fit" → af), so custom elements read <af-button>. */
function prefixFrom(name: string) {
  const words = name.toLowerCase().match(/[a-z][a-z0-9]*/g) ?? []
  const p = words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 3) : (words[0] ?? '').slice(0, 2)
  return p.length >= 2 ? p : 'ui'
}

const name = str('name') ?? (CONFIG_FILE ? current.name : basename(project))
const prefix = CONFIG_FILE ? current.prefix : (str('prefix') ?? prefixFrom(name))
const design = CONFIG_FILE ? current.designDir : 'design'

// 1. Skills: linked, so they update with the package.
const skillDirs = (str('skills-dir') ?? '.agents/skills').split(',').map((d) => d.trim()).filter(Boolean)
const skills = readdirSync(join(pkg, 'skills'))
const linked: string[] = []
for (const dir of skillDirs) {
  mkdirSync(resolve(project, dir), { recursive: true })
  for (const s of skills) {
    const at = join(dir, s)
    linked.push(at)
    if (existsSync(resolve(project, at))) {
      skipped.push(at)
      continue
    }
    symlinkSync(relative(resolve(project, dir), join(pkg, 'skills', s)), resolve(project, at), 'dir')
    done.push(`${at} → stitch2/skills/${s}`)
  }
}

// 2. The config.
const schema = relative(project, join(pkg, 'config.schema.json'))
write(
  CONFIG_NAME,
  `${JSON.stringify(
    {
      ...(schema.startsWith('node_modules') ? { $schema: `./${schema}` } : {}),
      name: `${name} design lab`,
      designDir: design,
      screenDirs: ['screens'],
      catalogDir: 'screens/components',
      prefix,
      order: [],
      skills: linked.filter((s) => s.startsWith(skillDirs[0]!)),
    },
    null,
    2,
  )}\n`,
)

// 3. Screen template, catalog and starter components.
const head = (title: string, extra: string) => `<!doctype html>
<html lang="en" data-theme="dark">
<head>
${extra}<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="${prefix}-frame-width" content="390" />
<title>${name} — ${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<script src="https://cdn.tailwindcss.com"></script>
<script src="/tailwind.tokens.js"></script>
<link rel="stylesheet" href="/tokens.css" />
<script src="/components/${prefix}.js" defer></script>
</head>
`
write(
  join(design, 'screens/_template.html'),
  `${head('Screen name', `<meta name="${prefix}-screen" content="screen-name" />\n<meta name="${prefix}-device" content="mobile" />\n<meta name="${prefix}-status" content="draft" />\n`)}<!--
  Template for ${name} screens. Copy it to ${design}/screens/<screen>/<device>-v<N>.html and set the ${prefix}-* meta
  tags (desktop: ${prefix}-device desktop and ${prefix}-frame-width 1280); status draft while you work, review when
  done. Files starting with _ are not shown on the canvas. Build with the components in the catalog
  (${design}/screens/components/catalog.html: header, section, card, row, button, chip); write plain markup only for what no component covers, with token
  classes (bg-background/surface/raised, border-border, text-text/text-muted, bg-primary, rounded-btn/card) and one
  .type-<level> class per text element. Fonts: load the families DESIGN.md names.
-->
<body class="bg-background font-sans text-text antialiased">
  <main class="mx-auto max-w-[390px] px-4 pb-24 pt-6">
    <${prefix}-header title="Title"></${prefix}-header>
  </main>
</body>
</html>
`,
)
write(
  join(design, 'screens/components/catalog.html'),
  `${head('Components', '')}<!-- The component catalog: every shared element and its variants. Screens use these elements and never rebuild
     them by hand; to change one, edit ${design}/components/${prefix}.js and look here. -->
<body class="bg-background font-sans text-text antialiased">
  <main class="mx-auto max-w-[390px] px-4 pb-24 pt-6">
    <${prefix}-header title="Components" meta="${name}"><${prefix}-button variant="secondary">Action</${prefix}-button></${prefix}-header>
    <${prefix}-section label="Buttons">
      <${prefix}-button full>Primary</${prefix}-button>
      <${prefix}-button variant="secondary" full>Secondary</${prefix}-button>
      <${prefix}-button variant="ghost" full>Ghost</${prefix}-button>
    </${prefix}-section>
    <${prefix}-section label="Chips">
      <div class="flex flex-wrap gap-2"><${prefix}-chip selected>Selected</${prefix}-chip><${prefix}-chip>Chip</${prefix}-chip></div>
    </${prefix}-section>
    <${prefix}-section label="Card">
      <${prefix}-card><p class="type-title-card text-text">Card title</p><p class="mt-1 type-body text-text-muted">Supporting text in a card.</p></${prefix}-card>
    </${prefix}-section>
    <${prefix}-section label="Rows in a list card">
      <${prefix}-card list>
        <${prefix}-row name="A row" meta="With a meta line" chevron></${prefix}-row>
        <${prefix}-row name="Another row" value="42"></${prefix}-row>
      </${prefix}-card>
    </${prefix}-section>
  </main>
</body>
</html>
`,
)
write(
  join(design, `components/${prefix}.js`),
  `// ${name}'s starter components for the design screens: light-DOM custom elements on DESIGN.md's tokens (the
// classes come from tailwind.tokens.js and tokens.css). Each marks its root data-${prefix}="<name>", which stitch2's
// checks and compare read. Extend them, or replace this file with your app's own components (stitch2 elements).
const P = '${prefix}'
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const flag = (el, a) => el.hasAttribute(a) && el.getAttribute(a) !== 'false'
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
const chevron =
  '<svg class="size-4 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'

/** Defines <P-name>: render(el) returns the markup; the element's own children go into [data-slot]. */
function define(name, render) {
  customElements.define(
    \`\${P}-\${name}\`,
    class extends HTMLElement {
      connectedCallback() {
        // Children are parsed after the opening tag: render once the document is complete.
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this.connectedCallback(), { once: true })
          return
        }
        if (this.dataset.rendered) return
        this.dataset.rendered = '1'
        const kids = [...this.childNodes]
        this.style.display = 'contents'
        this.innerHTML = render(this)
        const root = this.firstElementChild
        root?.setAttribute(\`data-\${P}\`, name)
        const slot = this.querySelector('[data-slot]')
        if (slot) slot.append(...kids)
      }
    },
  )
}

define(
  'header',
  (el) => \`<header class="mb-6 flex items-start justify-between gap-3"><div class="min-w-0">\${
    el.getAttribute('meta') ? \`<p class="type-meta text-text-muted">\${esc(el.getAttribute('meta'))}</p>\` : ''
  }<h1 class="truncate type-title-screen text-text">\${esc(el.getAttribute('title'))}</h1></div><div data-slot class="flex shrink-0 items-center gap-2"></div></header>\`,
)
define(
  'section',
  (el) =>
    \`<section class="mb-6"><h2 class="mb-2 type-label-caps text-text-muted">\${esc(el.getAttribute('label'))}</h2><div data-slot class="flex flex-col gap-3"></div></section>\`,
)
define('button', (el) => {
  const look = {
    primary: 'bg-primary text-on-primary hover:bg-primary-pressed',
    secondary: 'bg-raised text-text hover:bg-border',
    ghost: 'text-text-muted hover:text-text',
  }[el.getAttribute('variant') ?? 'primary']
  return \`<button type="button" data-slot class="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-btn px-5 type-label-button \${look} \${flag(el, 'full') ? 'w-full' : ''} \${focus}"></button>\`
})
define('chip', (el) => {
  const on = flag(el, 'selected')
  return \`<button type="button" aria-pressed="\${on}" data-slot class="inline-flex h-8 items-center rounded-full px-3 type-label-chip \${on ? 'bg-primary-wash text-primary' : 'bg-raised text-text-muted hover:text-text'} \${focus}"></button>\`
})
define(
  'card',
  (el) =>
    \`<div data-slot class="rounded-card border border-border bg-surface \${flag(el, 'list') ? 'overflow-hidden [&>*+*>*]:border-t [&>*+*>*]:border-border' : 'p-4'}"></div>\`,
)
define(
  'row',
  (el) => \`<div class="flex min-h-16 items-center gap-3 px-4 py-3"><span class="block min-w-0 flex-1"><span class="block truncate type-body-strong text-text">\${esc(el.getAttribute('name'))}</span>\${
    el.getAttribute('meta') ? \`<span class="block truncate type-meta text-text-muted">\${esc(el.getAttribute('meta'))}</span>\` : ''
  }</span>\${el.getAttribute('value') ? \`<span class="shrink-0 type-body-strong text-text">\${esc(el.getAttribute('value'))}</span>\` : ''}\${flag(el, 'chevron') ? chevron : ''}<span data-slot class="contents"></span></div>\`,
)
`,
)

// 4. DESIGN.md and tokens, through the commands themselves (they read the config just written).
const run = (cmd: string, more: string[] = []) =>
  execFileSync(process.execPath, [cli, cmd, ...more], { cwd: project, stdio: 'inherit' })
const designMd = join(project, design, 'DESIGN.md')
if (!existsSync(designMd) && str('primary')) {
  const pass = Object.entries(args)
    .filter(([k]) => !['prefix', 'skills-dir'].includes(k))
    .flatMap(([k, v]) => (v === true ? [`--${k}`] : [`--${k}`, v]))
  run('init', pass.includes('--name') ? pass : ['--name', name, ...pass])
}
if (existsSync(designMd)) run('tokens')

console.log(`\nstitch2 setup (${prefix}-* elements, design in ${design}/)`)
for (const f of done) console.log(`  wrote  ${f}`)
for (const f of skipped) console.log(`  kept   ${f}`)
console.log(
  existsSync(designMd)
    ? '\nnext: stitch2 canvas, then draft screens from the template (the stitch2 skill has the workflow)'
    : '\nnext: stitch2 init --name "…" --primary "#rrggbb" (or stitch2 extract <url>), then stitch2 tokens and stitch2 canvas',
)
