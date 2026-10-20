import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { collectComponents, type PageComponents, reuseIssues } from '../src/consistency.ts'

const page = (kinds: string[]): PageComponents =>
  ({ handBuilt: kinds.map((kind) => ({ kind, selector: kind, text: kind })) }) as PageComponents

test('a hand-built copy of a catalog component is an error', () => {
  const issues = reuseIssues('screens/home/mobile-v1.html', page(['chip']))
  assert.equal(issues.length, 1)
  assert.equal(issues[0].severity, 'error')
  assert.equal(issues[0].type, 'reuse')
  assert.match(issues[0].message, /built by hand/)
})

test('generated and trial screens are exempt: they cannot share components', () => {
  assert.deepEqual(reuseIssues('stitch/home.html', page(['chip'])), [])
})

test('faithful app snapshots are exempt: visual imports are not component implementations', () => {
  const snapshot = page(['header', 'button:primary:md'])
  snapshot.source = 'app'
  assert.deepEqual(reuseIssues('screens/home/desktop-v1.html', snapshot), [])
})

test('collector ignores closed menus and transparent primary fills', async () => {
  const browser = await chromium.launch()
  try {
    const browserPage = await browser.newPage({ viewport: { width: 900, height: 700 } })
    await browserPage.setContent(`
      <meta name="s2-source" content="app">
      <details><summary>Product</summary><a style="display:inline-block;width:120px;height:40px">Recipes</a></details>
      <a style="display:inline-block;width:120px;height:40px;background:rgba(147,51,234,0);border-radius:4px">Transparent</a>
    `)
    const found = await browserPage.evaluate(collectComponents, { prefix: 's2', primary: [147, 51, 234] })
    assert.equal(found.source, 'app')
    assert.deepEqual(found.handBuilt, [])
  } finally {
    await browser.close()
  }
})

test('card layout and size are declared variants, not accidental visual drift', async () => {
  const browser = await chromium.launch()
  try {
    const browserPage = await browser.newPage()
    await browserPage.setContent('<div data-s2="card" data-variant="media" data-layout="row" style="width:300px;height:72px;border-radius:12px">Row</div>' +
      '<div data-s2="card" data-variant="media" data-layout="showcase" data-size="compact" style="width:160px;height:220px;border-radius:16px">Showcase</div>')
    const found = await browserPage.evaluate(collectComponents, { prefix: 's2', primary: [147, 51, 234] })
    assert.ok(found.components['card:media:row:default'])
    assert.ok(found.components['card:media:showcase:compact'])
    assert.equal(Object.keys(found.components).filter((kind) => kind.startsWith('card:')).length, 2)
  } finally { await browser.close() }
})
