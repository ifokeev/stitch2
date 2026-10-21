/**
 * Smoke test: what an agent does first in a new project, end to end. Needs Chromium for Playwright
 * (npx playwright install chromium) and network access for the CDN scripts the screens load.
 * Run: pnpm test
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { chromium } from '@playwright/test'
import { audit, movingAnimations } from '../src/audit.ts'
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
  const out = stitch2('lint')
  // motion: is stitch2's extension; the linter's note about the unknown key is left out.
  assert.match(readFileSync(join(dir, 'design/DESIGN.md'), 'utf8'), /\nmotion:\n {2}duration-short: 150ms/)
  assert.doesNotMatch(out, /token-like-ignored/)
  assert.match(readFileSync(join(dir, 'design/tokens.css'), 'utf8'), /--af-duration-short: 150ms;/)
})

test('a screen made from the template is listed with its status', () => {
  mkdirSync(join(dir, 'design/screens/home'), { recursive: true })
  copyFileSync(join(dir, 'design/screens/_template.html'), join(dir, 'design/screens/home/mobile-v1.html'))
  const screens = JSON.parse(stitch2('screens', '--json')) as { screen: string; status: string; device: string }[]
  const home = screens.find((s) => s.screen === 'screen-name' || s.screen === 'home')
  assert.ok(home, JSON.stringify(screens))
  assert.equal(home.status, 'draft')
  assert.equal(home.device, 'mobile')
  // A tablet variant, named <device>-v<N> like the others.
  const tablet = readFileSync(join(dir, 'design/screens/_template.html'), 'utf8').replace(/<meta name="af-device"[^>]*>\n?/, '')
  writeFileSync(join(dir, 'design/screens/home/tablet-v1.html'), tablet)
  const listed = (JSON.parse(stitch2('screens', '--json')) as { path: string; device: string; version: string }[]).find((s) => s.path.endsWith('home/tablet-v1.html'))
  assert.deepEqual([listed?.device, listed?.version], ['tablet', 'v1'])
  rmSync(join(dir, 'design/screens/home/tablet-v1.html'))
})

test('approving makes one version current: earlier versions are archived, a newer proposal stays', () => {
  const home = readFileSync(join(dir, 'design/screens/home/mobile-v1.html'), 'utf8')
  mkdirSync(join(dir, 'design/screens/plan'), { recursive: true })
  const at = (status: string) => home.replace(/content="draft"/, `content="${status}"`).replace(/content="screen-name"|content="home"/, 'content="plan"')
  writeFileSync(join(dir, 'design/screens/plan/mobile-v1.html'), at('approved'))
  writeFileSync(join(dir, 'design/screens/plan/mobile-v2.html'), at('review'))
  writeFileSync(join(dir, 'design/screens/plan/mobile-v3.html'), at('review'))
  writeFileSync(join(dir, 'design/screens/plan/mobile-v4.html'), at('draft'))
  // Nothing unclear yet: v1 is current and the rest wait.
  stitch2('screens', 'plan', '--strict')
  assert.match(stitch2('approve', 'plan/mobile-v3'), /approved plan v3 mobile; archived v1, v2/)
  const status = (n: number) => {
    const s = (JSON.parse(stitch2('screens', 'plan', '--json')) as { version: string; status: string }[]).find(
      (x) => x.version === `v${n}`,
    )
    return s?.status
  }
  assert.deepEqual([1, 2, 3, 4].map(status), ['archived', 'archived', 'approved', 'draft'])
  // A version left behind by hand is reported, and --strict fails on it.
  writeFileSync(join(dir, 'design/screens/plan/mobile-v2.html'), at('review'))
  assert.match(stitch2('screens', 'plan'), /plan mobile: v2 is still review although v3 is approved/)
  assert.throws(() => stitch2('screens', 'plan', '--strict'))
})


test('screens of one page are listed under it by their state', () => {
  const home = readFileSync(join(dir, 'design/screens/home/mobile-v1.html'), 'utf8')
  const as = (screen: string, page?: string) =>
    home
      .replace(/<meta name="af-screen" content="[^"]*" \/>/, `<meta name="af-screen" content="${screen}" />`)
      .replace(/<meta name="af-page" content="[^"]*" \/>\n?/, page ? `<meta name="af-page" content="${page}" />\n` : '')
  for (const [screen, page] of [['shop', 'shop'], ['shop-cart', 'shop'], ['shop-pay-1', 'shop']]) {
    mkdirSync(join(dir, `design/screens/${screen}`), { recursive: true })
    writeFileSync(join(dir, `design/screens/${screen}/mobile-v1.html`), as(screen, page))
  }
  const list = JSON.parse(stitch2('screens', 'shop', '--json')) as { screen: string; page: string }[]
  assert.deepEqual(list.map((s) => [s.screen, s.page]), [['shop', 'shop'], ['shop-cart', 'shop'], ['shop-pay-1', 'shop']])
  assert.match(stitch2('screens', 'shop'), /shop \(page\)\n  main .*\n  cart .*\n  pay-1 /)
})


test('the starter catalog and screen pass the checks', () => {
  const out = stitch2('check', '--strict')
  assert.match(out, /0 errors\./)
  // The catalog's controls at rest, hovered, focused and pressed: the States sheet.
  assert.ok(existsSync(join(dir, 'design/states/index.html')))
  const sheet = JSON.parse(readFileSync(join(dir, 'design/states/states.json'), 'utf8'))
  const rows = sheet['screens/components/catalog.html']
  assert.ok(rows.length > 0 && rows[0].crops.pressed, JSON.stringify(rows?.[0]))
})

test('a filtered check refreshes only its own shared-dependency cache keys', () => {
  const checksFile = join(dir, 'design/checks.json')
  const keys = () => JSON.parse(readFileSync(checksFile, 'utf8')).cacheKeys as Record<string, string>
  const first = keys()
  const home = 'screens/home/mobile-v1.html'
  const plan = 'screens/plan/mobile-v3.html'
  assert.ok(first[home] && first[plan])
  // Editing an imported dependency must invalidate consumers without touching their HTML or catalog.
  writeFileSync(join(dir, 'design/components/cache-probe.css'), 'button { min-height: 44px }')
  stitch2('check', home, '--locales', 'none')
  const filtered = keys()
  assert.notEqual(filtered[home], first[home])
  assert.equal(filtered[plan], first[plan], 'an unvisited screen must retain its old key')
  stitch2('check', plan, '--locales', 'none')
  const next = keys()
  assert.notEqual(next[plan], first[plan], 'the second filtered run must revisit the other screen')
  assert.equal(next[home], filtered[home])
  rmSync(join(dir, 'design/components/cache-probe.css'))
})

test('with a light theme, check also runs the screens in it', () => {
  // setup --primary writes both themes; the renders show the second one with a suffix.
  assert.match(readFileSync(join(dir, 'design/DESIGN.md'), 'utf8'), /\n  light-/)
  stitch2('check', '--shots')
  const checks = JSON.parse(readFileSync(join(dir, 'design/checks.json'), 'utf8'))
  assert.ok(Object.keys(checks.screens).length >= 2)
  assert.ok(existsSync(join(dir, 'design/renders/screens__home__mobile-v1--light.png')))
})


test('check renders each variant at both ends of the widths it covers, and at the breakpoints inside them', () => {
  const configFile = join(dir, 'stitch2.config.json')
  const saved = readFileSync(configFile, 'utf8')
  writeFileSync(configFile, JSON.stringify({ ...JSON.parse(saved), breakpoints: { md: 480 } }, null, 2))
  // A 350 px block fits the 390 px phone frame (16 px margins) but not a 360 px window, the narrowest a phone covers.
  const home = readFileSync(join(dir, 'design/screens/home/mobile-v1.html'), 'utf8')
  mkdirSync(join(dir, 'design/screens/wide'), { recursive: true })
  writeFileSync(
    join(dir, 'design/screens/wide/mobile-v1.html'),
    home.replace('</main>', '<p style="width: 350px">A fixed-width line that is wider than a small phone</p></main>'),
  )
  stitch2('check', 'wide', '--shots')
  const issues = JSON.parse(readFileSync(join(dir, 'design/checks.json'), 'utf8')).screens['screens/wide/mobile-v1.html']
  const narrow = issues.filter((i: { width?: number }) => i.width === 360)
  assert.ok(narrow.length > 0, JSON.stringify(issues))
  assert.match(narrow[0].message, /^at 360px: /)
  assert.ok(!issues.some((i: { width?: number; type: string }) => !i.width && i.type === 'overflow'), 'fits as drawn')
  for (const w of [360, 480, 599]) assert.ok(existsSync(join(dir, `design/renders/screens__wide__mobile-v1--${w}px.png`)), String(w))
  rmSync(join(dir, 'design/screens/wide'), { recursive: true })
  writeFileSync(configFile, saved)
})

test('check runs each app state a screen is not drawn in, and tags what only shows there', () => {
  const configFile = join(dir, 'stitch2.config.json')
  const saved = readFileSync(configFile, 'utf8')
  writeFileSync(
    configFile,
    JSON.stringify({ ...JSON.parse(saved), modes: [{ name: 'account', values: [{ value: 'guest', label: 'Guest' }, { value: 'member', label: 'Member' }] }] }, null, 2),
  )
  // A line that is wider than the phone frame, drawn only for a member.
  const home = readFileSync(join(dir, 'design/screens/home/mobile-v1.html'), 'utf8')
  const member = '<style>.members { display: none } html[data-account="member"] .members { display: block; width: 600px }</style><p class="members">A members-only line that is wider than the phone</p></main>'
  const screenFile = (html: string) => {
    mkdirSync(join(dir, 'design/screens/gated'), { recursive: true })
    writeFileSync(join(dir, 'design/screens/gated/mobile-v1.html'), html)
  }
  const checked = () =>
    JSON.parse(readFileSync(join(dir, 'design/checks.json'), 'utf8')).screens['screens/gated/mobile-v1.html'] as { type: string; mode?: string; message: string }[]

  // Drawn without the attribute: both states are checked, and only the member one overflows.
  screenFile(home.replace('</main>', member))
  stitch2('check', 'gated', '--shots')
  const states = checked().filter((i) => i.mode)
  assert.ok(states.some((i) => i.type === 'overflow' && i.mode === 'account:member' && i.message.startsWith('Member: ')), JSON.stringify(checked()))
  assert.ok(!states.some((i) => i.mode === 'account:guest'), 'the guest state is fine')
  assert.ok(!checked().some((i) => i.type === 'overflow' && !i.mode), 'fits as drawn')
  assert.ok(existsSync(join(dir, 'design/renders/screens__gated__mobile-v1--account-member.png')))
  assert.ok(existsSync(join(dir, 'design/renders/screens__gated__mobile-v1--account-guest.png')))

  // Drawn as a member: that state is the screen's own, so it is checked once, untagged; only the guest is added.
  screenFile(home.replace('<html', '<html data-account="member"').replace('</main>', member))
  stitch2('check', 'gated', '--shots')
  assert.ok(checked().some((i) => i.type === 'overflow' && !i.mode), 'the drawn state reports as before')
  assert.ok(!checked().some((i) => i.mode === 'account:member'), 'the state the screen is drawn in is not checked again')

  rmSync(join(dir, 'design/screens/gated'), { recursive: true })
  writeFileSync(configFile, saved)
})

test('setup again keeps every existing file', () => {
  const before = readFileSync(join(dir, 'design/components/af.js'), 'utf8')
  const out = stitch2('setup', '--name', 'Something else', '--primary', '#FF0000')
  assert.match(out, /kept {3}design\/components\/af\.js/)
  assert.equal(readFileSync(join(dir, 'design/components/af.js'), 'utf8'), before)
})

test('the canvas serves the screen list, and says when a report is older than the screens it covers', async () => {
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
    const reports = () => fetch(`http://127.0.0.1:${port}/api/reports`).then((r) => r.json())
    assert.equal((await reports()).consistency, null)
    const report = join(dir, 'design/consistency/index.html')
    mkdirSync(join(dir, 'design/consistency'), { recursive: true })
    writeFileSync(report, '<p>report</p>')
    assert.deepEqual((await reports()).consistency.changed, [])
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(report, old, old)
    assert.ok((await reports()).consistency.changed.includes('screens/components/catalog.html'))
    rmSync(join(dir, 'design/consistency'), { recursive: true })
    // Frames out of view are drawn from pictures the server renders, then keeps.
    const picture = `http://127.0.0.1:${port}/api/shot?path=screens/components/catalog.html&width=390`
    const first = await fetch(picture)
    assert.equal(first.status, 200, await first.clone().text())
    assert.equal(first.headers.get('content-type'), 'image/jpeg')
    const jpg = Buffer.from(await first.arrayBuffer())
    assert.deepEqual([...jpg.subarray(0, 2)], [0xff, 0xd8])
    const again = Date.now()
    assert.equal((await fetch(picture)).status, 200)
    assert.ok(Date.now() - again < 500, 'the second picture comes from the cache')
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/shot?path=screens/nope.html&width=390`)).status, 404)
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
      '<af-header title="Today" data-t-title="hello.title"></af-header><p class="type-body" data-t="hello.sets" data-t-args="count=3">3 sets</p><p class="type-body" data-t="hello.only_en">Only here</p><p class="type-body" data-t="hello.nope">Nope</p><p class="type-body">Loose words</p><p class="type-body" translate="no">Bench Press</p><p class="type-body" data-t="{hello.sets|count=5} · {hello.title}">5 sets · Today</p><p class="type-body" data-t="{hello.body weight} · {@date|value=2026-10-04;weekday=short;day=numeric;month=short} · {@number|value=7920}">Body weight · Sun, 4 Oct · 7,920</p><p class="type-body" data-t="hello.at" data-t-args="count=312">Showing what you can do at <b data-t-slot="place" translate="no">Home gym</b>: 312 exercises.</p><p class="type-body" data-t="{hello.at|place={hello.title};count={@number|value=1324}}">Showing what you can do at Today: 1,324 exercises.</p>',
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
    // Nested: a message, and a formatted number, as another message's arguments.
    assert.match(ru.texts[8]!, /^Упражнения для Сегодня: 1\s324\.$/)
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
        '<span style="display:block">5 упражнений · Линейная прогрессия</span></button>' +
        '<button id="rail" style="width:60px;display:flex;flex-direction:column"><span style="display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden">Einstellungen und mehr</span></button></body>',
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

test('audit: a control scrolled out of a strip does not overlap what sits beside the strip', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 600, height: 300 } })
    await page.setContent(
      '<body style="margin:0;font:16px sans-serif"><header style="display:flex;width:400px">' +
        '<nav style="display:flex;flex:1;min-width:0;overflow-x:auto;gap:8px">' +
        ['Features', 'Screens', 'Assistants', 'Documentation', 'GitHub'].map((l) => '<a href="#" style="flex:none;padding:12px">' + l + '</a>').join('') +
        '</nav><button style="flex:none;width:44px;height:44px" aria-label="Theme">☼</button></header>' +
        '<div style="display:flex"><button style="width:120px;height:44px">One</button><button style="width:120px;height:44px;margin-left:-40px">Two</button></div></body>',
    )
    const overlaps = (await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === 'control-overlap')
    assert.deepEqual(overlaps.map((i) => i.text), ['Two'])
  } finally {
    await browser.close()
  }
})

test('audit: a fixed bar shown inside a transformed box (a catalog) is not a screen bar', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 300 } })
    const bar = (label: string) =>
      '<nav style="position:fixed;left:0;right:0;bottom:0;height:64px;display:flex">' +
      ['A', 'B', 'C'].map((l) => '<button style="flex:1">' + label + l + '</button>').join('') +
      '</nav>'
    await page.setContent(
      '<body style="margin:0;font:16px sans-serif"><div style="height:900px"></div>' +
        '<div style="position:relative;height:80px;transform:translateZ(0)">' + bar('In box ') + '</div>' +
        '<div style="height:200px"></div>' + bar('Screen ') + '</body>',
    )
    const issues = await page.evaluate(audit, { comfortable: 32 })
    const cut = issues.filter((i) => i.type === 'overflow' && /fixed bar/.test(i.message))
    assert.deepEqual(cut, [])
  } finally {
    await browser.close()
  }
})

test('audit: a nav whose links scroll or are cut is an error; links wrapped out of sight, or in a closed menu, are not', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 600, height: 400 } })
    const links = ['Features', 'Screens', 'Assistants', 'Documentation', 'GitHub']
      .map((l) => '<a href="#" style="flex:none;padding:12px">' + l + '</a>')
      .join('')
    const nav = (style: string) =>
      '<body style="margin:0;font:16px sans-serif"><header style="display:flex;width:400px">' +
      '<nav style="display:flex;flex:1;min-width:0;gap:8px;' + style + '">' + links + '</nav>' +
      '<details><summary aria-label="Menu" style="width:44px;height:44px">≡</summary>' +
      '<nav style="position:absolute;top:50px;left:0">' + links + '</nav></details></header>' +
      '<p style="margin-top:20px">Know what to lift. Log it in seconds.</p></body>'
    await page.setContent(nav('overflow-x:auto'))
    const scrolled = (await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === 'nav-overflow')
    assert.equal(scrolled.length, 1)
    await page.setContent(nav('flex-wrap:wrap;height:44px;overflow:hidden'))
    const wrapped = await page.evaluate(audit, { comfortable: 32 })
    assert.deepEqual(wrapped.filter((i) => i.type === 'nav-overflow' || i.type === 'text-overlap'), [])
  } finally {
    await browser.close()
  }
})

test('motion: a transition length DESIGN.md does not name, and what still moves with reduced motion', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } })
    await page.setContent(
      '<style>@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 50% { opacity: .5 } }' +
        '.spin { animation: spin 1s linear infinite } .pulse { animation: pulse 2s infinite }' +
        '@media (prefers-reduced-motion: reduce) { .safe { animation: none } }</style>' +
        '<body style="margin:0;font:16px sans-serif"><button id="ok" style="transition: background-color 150ms">Save</button>' +
        '<button id="odd" style="transition: background-color 180ms">Cancel</button>' +
        '<span class="spin">Syncing</span><span class="spin safe">Saving</span><span class="pulse">Loading</span></body>',
    )
    const issues = await page.evaluate(audit, { comfortable: 32, durations: [150, 250] })
    assert.deepEqual(issues.filter((i) => i.type === 'motion-token').map((i) => i.text), ['Cancel'])
    await page.emulateMedia({ reducedMotion: 'reduce' })
    // The spinner without a reduced-motion rule still turns; the guarded one stops and the fade may stay.
    assert.deepEqual((await page.evaluate(movingAnimations)).map((i) => i.text), ['Syncing'])
  } finally {
    await browser.close()
  }
})

test('audit: a phone column in a tablet-wide window is narrow-layout; a short centred card is not', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 768, height: 600 } })
    const column = (rows: number) =>
      '<body style="margin:0;font:16px sans-serif"><main style="max-width:358px;margin:0 auto">' +
      Array.from({ length: rows }, (_, i) => '<p style="background:#eee;padding:20px">Workout ' + i + '</p>').join('') +
      '</main><nav style="position:fixed;bottom:0;left:0;right:0;background:#ddd"><button>Home</button></nav></body>'
    await page.setContent(column(20))
    const long = (await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === 'narrow-layout')
    assert.equal(long.length, 1)
    assert.match(long[0]!.message, /takes 358 of 768px/)
    await page.setContent(column(2))
    assert.equal((await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === 'narrow-layout').length, 0)
  } finally {
    await browser.close()
  }
})
