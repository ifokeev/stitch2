/**
 * Smoke test: what an agent does first in a new project, end to end. Needs Chromium for Playwright
 * (npx playwright install chromium) and network access for the CDN scripts the screens load.
 * Run: pnpm test
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { chromium } from '@playwright/test'
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

test('with a light theme, check also runs the screens in it', () => {
  // setup --primary writes both themes; the renders show the second one with a suffix.
  assert.match(readFileSync(join(dir, 'design/DESIGN.md'), 'utf8'), /\n  light-/)
  stitch2('check', '--shots')
  const checks = JSON.parse(readFileSync(join(dir, 'design/checks.json'), 'utf8'))
  assert.ok(Object.keys(checks.screens).length >= 2)
  assert.ok(existsSync(join(dir, 'design/renders/screens__home__mobile-v1--light.png')))
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

test('languages: screens read the messages, and the report and check find what is missing', async () => {
  mkdirSync(join(dir, 'i18n'), { recursive: true })
  writeFileSync(join(dir, 'i18n/en.json'), JSON.stringify({ hello: { title: 'Today', sets: { one: '{count} set', other: '{count} sets' }, only_en: 'Only here' } }))
  writeFileSync(join(dir, 'i18n/ru.json'), JSON.stringify({ hello: { title: 'Сегодня', sets: { one: '{count} подход', few: '{count} подхода', many: '{count} подходов', other: '{count} подхода' } } }))
  const configFile = join(dir, 'stitch2.config.json')
  const config = JSON.parse(readFileSync(configFile, 'utf8'))
  config.i18n = { locales: ['en', 'ru'], messages: 'i18n/{locale}.json', check: ['ru'] }
  writeFileSync(configFile, JSON.stringify(config, null, 2))
  mkdirSync(join(dir, 'design/screens/hello'), { recursive: true })
  const screen = readFileSync(join(dir, 'design/screens/_template.html'), 'utf8')
    .replace('content="screen-name"', 'content="hello"')
    .replace(
      /<af-header[^>]*><\/af-header>/,
      '<af-header title="Today" data-t-title="hello.title"></af-header><p class="type-body" data-t="hello.sets" data-t-args="count=3">3 sets</p><p class="type-body" data-t="hello.only_en">Only here</p><p class="type-body" data-t="hello.nope">Nope</p><p class="type-body">Loose words</p><p class="type-body" translate="no">Bench Press</p>',
    )
  writeFileSync(join(dir, 'design/screens/hello/mobile-v1.html'), screen)

  let report: string
  try {
    report = stitch2('i18n', 'hello', '--json')
    assert.fail('an unknown key exits 1')
  } catch (e) {
    report = (e as { stdout: string }).stdout
  }
  const [hello] = JSON.parse(report).screens
  assert.deepEqual(hello.unknown.map((u: { key: string }) => u.key), ['hello.nope'])
  assert.deepEqual(hello.missing.ru, ['hello.only_en'])
  assert.deepEqual(hello.loose.map((l: { text: string }) => l.text), ['Loose words'])

  stitch2('check', 'hello', '--shots')
  const issues = JSON.parse(readFileSync(join(dir, 'design/checks.json'), 'utf8')).screens['screens/hello/mobile-v1.html']
  const of = (type: string) => issues.filter((i: { type: string }) => i.type === type)
  assert.equal(of('i18n-unknown-key').length, 1, JSON.stringify(issues))
  assert.equal(of('i18n-missing').length, 1, JSON.stringify(issues))
  for (const l of ['ru', 'pseudo', 'pseudo-rtl'])
    assert.ok(existsSync(join(dir, `design/renders/screens__hello__mobile-v1--${l}.png`)), l)

  const port = String(4500 + Math.floor(Math.random() * 400))
  const server = spawn(process.execPath, [cli, 'canvas'], { cwd: dir, env: { ...process.env, PORT: port } })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const open = async (lang: string) => {
      for (let i = 0; i < 50; i++) {
        const ok = await page.goto(`http://127.0.0.1:${port}/screens/hello/mobile-v1.html?lang=${lang}`).then(() => true, () => false)
        if (ok) break
        await new Promise((r) => setTimeout(r, 100))
      }
      await page.waitForFunction(() => document.querySelector('h1')?.textContent)
      return page.evaluate(() => ({
        dir: document.documentElement.dir,
        h1: document.querySelector('h1')!.textContent,
        texts: [...document.querySelectorAll('main p')].map((p) => p.textContent),
      }))
    }
    const ru = await open('ru')
    assert.equal(ru.h1, 'Сегодня')
    assert.deepEqual(ru.texts, ['3 подхода', 'Only here', 'Nope', 'Loose words', 'Bench Press'])
    assert.equal((await open('pseudo-rtl')).dir, 'rtl')
    assert.match((await open('pseudo')).h1!, /^\[Ţóðáý ·+\]$/)
  } finally {
    await browser.close()
    server.kill()
  }
})
