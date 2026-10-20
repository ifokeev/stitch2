import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Browser } from '@playwright/test'
import { collectText, typeIssues } from '../src/typecheck.ts'

let browser: Browser
let root: string
let colourIssues: typeof import('../src/colours.ts').colourIssues
before(async () => {
  root = mkdtempSync(join(tmpdir(), 'stitch2-content-checks-'))
  mkdirSync(join(root, 'design/screens/example'), { recursive: true })
  writeFileSync(join(root, 'stitch2.config.json'), JSON.stringify({ designDir: 'design', prefix: 's2' }))
  process.env.STITCH2_CONFIG = join(root, 'stitch2.config.json')
  ;({ colourIssues } = await import('../src/colours.ts'))
  browser = await chromium.launch()
})
after(async () => { await browser?.close(); if (root) rmSync(root, { recursive: true, force: true }) })

test('colour literals in code content and syntax highlighting are not UI token violations', () => {
  const file = 'screens/example/mobile-v1.html'
  writeFileSync(join(root, 'design', file), '<meta name="s2-source" content="lab">\n' +
    '<pre style="background:#123456"><code><span style="color:#abcdef">const color = "#f00";</span>\nrgba(10, 20, 30, 0.5)</code></pre>\n' +
    '<p>Pass <code>"#00ff00"</code> as the value.</p>\n' +
    '<button style="color:#fedcba">Generate</button>')
  const issues = colourIssues(file)
  assert.equal(issues.length, 2)
  assert.match(issues[0]!.message, /Colour #123456.*:2;/)
  assert.match(issues[1]!.message, /Colour #fedcba.*:5;/)
})

test('app captures retain their original literals without a token migration demand', () => {
  const file = 'screens/example/desktop-v1.html'
  writeFileSync(join(root, 'design', file), '<meta name="s2-source" content="app"><button style="color:#f00">Generate</button>')
  assert.deepEqual(colourIssues(file), [])
})

test('colour prose, copied source and vector fills do not conceal real UI styling', () => {
  const file = 'screens/example/desktop-v2.html'
  writeFileSync(join(root, 'design', file), '<meta name="s2-source" content="lab">' +
    '<p>Choose #00ff00 or rgba(12, 34, 56, 0.5).</p>' +
    '<button data-code="const color = \'#f00\'" style="color:#fedcba">Copy</button>' +
    '<svg class="text-[#123456]"><path fill="#abcdef" /></svg>')
  assert.deepEqual(colourIssues(file).map((issue) => issue.message.match(/^Colour ([^ ]+)/)?.[1]), ['#fedcba', '#123456'])
})

test('code preserves literal case and monospace styles while surrounding UI capitals remain checked', async () => {
  const page = await browser.newPage()
  try {
    await page.setContent('<style>body{font:14px/21px sans-serif}pre,code{font:19px/24px monospace}</style>' +
      '<p id="ui-caps">OUTPUT SETTINGS</p><pre><code><span id="token">SERVICE_TOKEN</span>\n<span id="version">2.35</span></code></pre>' +
      '<p>Set <code id="inline">API_KEY</code> before starting.</p>')
    const items = await page.evaluate(collectText)
    const issues = typeIssues([], items)
    assert.deepEqual(issues.filter((i) => i.type === 'type-caps').map((i) => i.selector), ['#ui-caps'])
    assert.deepEqual(issues.filter((i) => i.type === 'type-mono-number'), [])
    assert.equal(items.find((item) => item.selector === '#token')!.code, true)
    assert.equal(items.find((item) => item.selector === '#inline')!.code, true)
    assert.equal(items.find((item) => item.selector === '#ui-caps')!.code, false)
  } finally { await page.close() }
})
