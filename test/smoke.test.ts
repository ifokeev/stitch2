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
import { audit } from '../src/audit.ts'
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
  writeFileSync(join(dir, 'i18n/en.json'), JSON.stringify({ hello: { title: 'Today', sets: { one: '{count} set', other: '{count} sets' }, only_en: 'Only here', 'body weight': 'Body weight', at: 'Showing what you can do at {place}: {count} exercises.' } }))
  writeFileSync(join(dir, 'i18n/ru.json'), JSON.stringify({ hello: { title: 'Сегодня', sets: { one: '{count} подход', few: '{count} подхода', many: '{count} подходов', other: '{count} подхода' }, 'body weight': 'Собственный вес', at: 'Упражнения для {place}: {count}.' } }))
  const configFile = join(dir, 'stitch2.config.json')
  const config = JSON.parse(readFileSync(configFile, 'utf8'))
  config.i18n = { locales: ['en', 'ru'], messages: 'i18n/{locale}.json', check: ['ru'] }
  writeFileSync(configFile, JSON.stringify(config, null, 2))
  mkdirSync(join(dir, 'design/screens/hello'), { recursive: true })
  const screen = readFileSync(join(dir, 'design/screens/_template.html'), 'utf8')
    .replace('content="screen-name"', 'content="hello"')
    .replace(
      /<af-header[^>]*><\/af-header>/,
      '<af-header title="Today" data-t-title="hello.title"></af-header><p class="type-body" data-t="hello.sets" data-t-args="count=3">3 sets</p><p class="type-body" data-t="hello.only_en">Only here</p><p class="type-body" data-t="hello.nope">Nope</p><p class="type-body">Loose words</p><p class="type-body" translate="no">Bench Press</p><p class="type-body" data-t="{hello.sets|count=5} · {hello.title}">5 sets · Today</p><p class="type-body" data-t="{hello.body weight} · {@date|value=2026-10-04;weekday=short;day=numeric;month=short} · {@number|value=7920}">Body weight · Sun, 4 Oct · 7,920</p><p class="type-body" data-t="hello.at" data-t-args="count=312">Showing what you can do at <b data-t-slot="place" translate="no">Home gym</b>: 312 exercises.</p>',
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
    assert.deepEqual(ru.texts.slice(0, 6), ['3 подхода', 'Only here', 'Nope', 'Loose words', 'Bench Press', '5 подходов · Сегодня'])
    // A key with a space, a date and a number, in the locale's own formats.
    assert.match(ru.texts[6]!, /^Собственный вес · вс, 4 окт\. · 7\s920$/)
    // Rich text: the slot keeps its element inside the translated sentence.
    assert.equal(ru.texts[7], 'Упражнения для Home gym: 312.')
    assert.equal(await page.evaluate(() => document.querySelector('main p:nth-of-type(8) b')?.textContent), 'Home gym')
    assert.equal((await open('pseudo-rtl')).dir, 'rtl')
    assert.match((await open('pseudo')).h1!, /^\[Ţóðáý ·+\]$/)
  } finally {
    await browser.close()
    server.kill()
  }
})

test('audit: a wrapped button label is an error, a row with a title and a wrapped meta line is not', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } })
    await page.setContent(
      '<body style="margin:0;font:16px sans-serif">' +
        '<button id="label" style="width:80px">Start the workout now</button>' +
        '<button id="row" style="display:block;width:160px;text-align:start"><span style="display:block">Push</span>' +
        '<span style="display:block">5 упражнений · Линейная прогрессия</span></button></body>',
    )
    const issues = await page.evaluate(audit, { comfortable: 32 })
    const wraps = issues.filter((i) => i.type === 'label-wraps').map((i) => i.text)
    assert.deepEqual(wraps, ['Start the workout now'])
  } finally {
    await browser.close()
  }
})

test("audit: Google's rules (type size, margins, line length, targets, labels, names, navigation, focus)", async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 700 } })
    const long = 'Every rep last time, so the next session adds a small step to the weight and keeps the same reps. '.repeat(4)
    await page.setContent(
      '<style>body{margin:0;font:16px sans-serif} .ok:focus-visible{outline:2px solid blue} main{padding:0 16px}</style>' +
        '<p style="margin:0;padding-left:4px;font-size:16px">Too close to the edge</p><main>' +
        '<p style="font-size:9px">Tiny print</p>' +
        '<div><button style="width:40px;height:40px;outline:none" aria-label="Less">-</button>' +
        '<button style="width:40px;height:40px;outline:none" aria-label="More">+</button></div>' +
        '<input placeholder="Your name">' +
        '<label for="n">Name</label><input id="n" placeholder="Ivan" class="ok">' +
        '<button class="ok" style="width:48px;height:48px"><svg width="24" height="24"></svg></button>' +
        '<button class="ok" aria-label="Share" style="width:48px;height:48px"><svg width="24" height="24"></svg></button>' +
        '</main><nav style="position:fixed;bottom:0;left:0;right:0;display:flex">' +
        ['Home', 'Plan', 'Start', 'Library', 'Stats', 'More'].map((l) => '<a class="ok" href="#" style="flex:1;padding:16px 0;text-align:center">' + l + '</a>').join('') +
        '</nav>',
    )
    const issues = await page.evaluate(audit, { comfortable: 32 })
    const of = (type: string) => issues.filter((i) => i.type === type).map((i) => i.text)
    assert.deepEqual(of('edge-margin'), ['Too close to the edge'])
    assert.deepEqual(of('text-small'), ['Tiny print'])
    assert.ok(of('tap-spacing').length >= 1, JSON.stringify(issues))
    assert.equal(of('placeholder-label').length, 1)
    assert.equal(of('unnamed-control').length, 1)
    assert.equal(of('nav-destinations').length, 1)
    // The two plain buttons have outline:none and nothing else on focus; the .ok ones have a ring, inputs the browser's.
    assert.equal(issues.filter((i) => i.type === 'focus-visible').length, 2, JSON.stringify(issues.filter((i) => i.type === 'focus-visible')))
    // Line length, on a desktop-wide page: the uncapped paragraph runs past 75 characters, the capped one does not.
    await page.setViewportSize({ width: 1280, height: 700 })
    await page.setContent('<body style="margin:0;padding:0 24px;font:16px sans-serif"><p id="wide">' + long + '</p><p style="max-width:32em">' + long + '</p></body>')
    const wide = (await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === 'measure')
    assert.equal(wide.length, 1, JSON.stringify(wide))
    assert.equal(wide[0]!.selector, '#wide')
  } finally {
    await browser.close()
  }
})

test('elements: ids repeated by separately rendered components are renamed, with their labels', async () => {
  const { build } = await import('esbuild')
  const entry = fileURLToPath(new URL('../src/elements.ts', import.meta.url))
  const bundle = await build({
    stdin: {
      contents:
        'import { defineElements } from ' + JSON.stringify(entry) + '\n' +
        "defineElements({ field: 1 }, { prefix: 'x', render: (_c, p) => '<div><label for=\"f\">' + p.label + '</label><input id=\"f\"></div>' })",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
  })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent('<x-field label="Reps"></x-field><x-field label="Notes"></x-field>')
    await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
    const labels = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.labels?.[0]?.textContent))
    assert.deepEqual(labels, ['Reps', 'Notes'])
  } finally {
    await browser.close()
  }
})
