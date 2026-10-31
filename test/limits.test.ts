import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'
import { audit } from '../src/audit.ts'
import { RULE_DEFAULTS, type RuleLimits } from '../src/config.ts'

// The numbers some checks hold a screen to are the project's to set (config "rules"); the defaults are the published ones, and the page-side copy of them agrees with the config's.
let browser: Browser
let page: Page
before(async () => {
  browser = await chromium.launch()
  page = await browser.newPage({ viewport: { width: 700, height: 700 } })
})
after(async () => { await browser?.close() })
const STYLE = '<style>*{box-sizing:border-box}body{margin:0;padding:16px;font:16px/24px sans-serif}p{margin:4px 0;font:14px/20px sans-serif;width:480px}input{display:block;height:44px;width:360px}' +
  '.menu{width:240px;padding:4px}.menu button{display:block;width:100%;border:0;background:none;font:inherit;text-align:start}.prose{width:900px;font:16px/24px sans-serif}</style>'
const read = async (html: string, type: string, limits?: Partial<RuleLimits>) => {
  await page.setContent(STYLE + html)
  return (await page.evaluate(audit, { comfortable: 32, limits })).filter((i) => i.type === type)
}
const hint = (characters: number) => '<label for="f">Name</label><p id="f-hint">' + 'x'.repeat(characters) + '</p><input id="f" aria-describedby="f-hint">'
const menu = (height: number) => '<div role="menu" class="menu"><button role="menuitem" style="height:' + height + 'px">Rename</button><button role="menuitem" style="height:' + height + 'px">Archive</button></div>'
const prose = (words: number) => '<p class="prose">' + Array.from({ length: words }, (_, i) => 'word' + (i % 10)).join(' ') + '</p>'

test('the defaults the page repeats are the config\'s: a hint at the limit passes and one over it does not, with or without the config\'s numbers', async () => {
  for (const limits of [undefined, RULE_DEFAULTS]) {
    assert.equal((await read(hint(RULE_DEFAULTS.hintCharacters), 'hint-length', limits)).length, 0, 'a hint of exactly the limit')
    assert.equal((await read(hint(RULE_DEFAULTS.hintCharacters + 1), 'hint-length', limits)).length, 1, 'one character over')
    assert.equal((await read(menu(RULE_DEFAULTS.menuItemHeight), 'menu-item-size', limits)).length, 0, 'a menu item of exactly the height')
    assert.equal((await read(menu(RULE_DEFAULTS.menuItemHeight - 2), 'menu-item-size', limits)).length, 1, 'two pixels under')
  }
})

test('a project\'s own numbers replace the defaults: a longer hint, a taller menu row, a longer measure', async () => {
  assert.equal((await read(hint(120), 'hint-length')).length, 1, 'by default 120 characters is long')
  assert.equal((await read(hint(120), 'hint-length', { hintCharacters: 140 })).length, 0, 'the project allows 140')
  assert.equal((await read(menu(46), 'menu-item-size')).length, 0, '46px passes by default')
  assert.equal((await read(menu(46), 'menu-item-size', { menuItemHeight: 48 })).length, 1, 'the project asks for 48')
  assert.match((await read(menu(46), 'menu-item-size', { menuItemHeight: 48 }))[0]!.message, /48px at least/, 'and the message names its number')
  assert.equal((await read(prose(60), 'measure')).length, 1, 'a line of 100 characters is over the default 80')
  assert.equal((await read(prose(60), 'measure', { measureLongest: 120 })).length, 0, 'the project allows longer lines')
})
