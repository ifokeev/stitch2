/**
 * Smoke test: what an agent does first in a new project, end to end. Needs Chromium for Playwright
 * (npx playwright install chromium) and network access for the CDN scripts the screens load.
 * Run: pnpm test
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
let dir = ''
const stitch2 = (...args: string[]) =>
  execFileSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'stitch2-smoke-'))
})
after(() => rmSync(dir, { recursive: true, force: true }))

test('setup writes the config, the starter design files, DESIGN.md and its tokens, and links the skills', () => {
  stitch2('setup', '--name', 'Acme Fit', '--primary', '#2F6FEB')
  const config = JSON.parse(readFileSync(join(dir, 'stitch2.config.json'), 'utf8'))
  assert.equal(config.prefix, 'af')
  for (const f of [
    'design/DESIGN.md',
    'design/tokens.css',
    'design/tailwind.tokens.js',
    'design/components/af.js',
    'design/screens/_template.html',
    'design/screens/components/catalog.html',
  ])
    assert.ok(existsSync(join(dir, f)), f)
  assert.ok(lstatSync(join(dir, '.agents/skills/stitch2')).isSymbolicLink())
  assert.ok(existsSync(join(dir, '.agents/skills/stitch2/SKILL.md')))
})

test('the generated DESIGN.md passes the linter', () => {
  stitch2('lint')
})

test('a screen made from the template is listed with its status', () => {
  mkdirSync(join(dir, 'design/screens/home'), { recursive: true })
  copyFileSync(join(dir, 'design/screens/_template.html'), join(dir, 'design/screens/home/mobile-v1.html'))
  const screens = JSON.parse(stitch2('screens', '--json')) as { screen: string; status: string; device: string }[]
  const home = screens.find((s) => s.screen === 'screen-name' || s.screen === 'home')
  assert.ok(home, JSON.stringify(screens))
  assert.equal(home.status, 'draft')
  assert.equal(home.device, 'mobile')
})

test('the starter catalog and screen pass the checks', () => {
  const out = stitch2('check', '--strict')
  assert.match(out, /0 errors\./)
})

test('setup again keeps every existing file', () => {
  const before = readFileSync(join(dir, 'design/components/af.js'), 'utf8')
  const out = stitch2('setup', '--name', 'Something else', '--primary', '#FF0000')
  assert.match(out, /kept {3}design\/components\/af\.js/)
  assert.equal(readFileSync(join(dir, 'design/components/af.js'), 'utf8'), before)
})

test('the canvas serves the screen list', async () => {
  const port = String(4500 + Math.floor(Math.random() * 400))
  const server = spawn(process.execPath, [cli, 'canvas'], { cwd: dir, env: { ...process.env, PORT: port } })
  try {
    let list: unknown
    for (let i = 0; i < 50 && !list; i++) {
      await new Promise((r) => setTimeout(r, 100))
      list = await fetch(`http://127.0.0.1:${port}/api/screens`)
        .then((r) => r.json())
        .catch(() => undefined)
    }
    assert.ok(Array.isArray(list) && list.length >= 2, JSON.stringify(list))
  } finally {
    server.kill()
  }
})

