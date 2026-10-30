import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { audit } from '../src/audit.ts'

// Menus: the size of an item, a border on a row, links under a menu role, and an icon on some items of a group and not on others.
const issues = async (html: string, type: string) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
    await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font:15px sans-serif;background:#111;color:#eee}.menu{width:240px;margin:20px;padding:4px;border:1px solid #444;border-radius:12px;background:#222}' +
      '.menu a,.menu button{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:0 16px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:start;text-decoration:none}</style>' + html)
    return (await page.evaluate(audit, { comfortable: 44 })).filter((i) => i.type === type)
  } finally { await browser.close() }
}
const svg = '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M2 12h20"/></svg>'

test('menu-item-size: an item under 44px, or with text under 14px, is reported; a row of 48px is not', async () => {
  const small = await issues('<div role="menu" class="menu"><button role="menuitem" style="min-height:32px;font-size:13px">Rename</button><button role="menuitem" style="min-height:32px;font-size:13px">Archive</button></div>', 'menu-item-size')
  assert.equal(small.length, 1, JSON.stringify(small))
  assert.equal((await issues('<div role="menu" class="menu"><button role="menuitem">Rename</button><button role="menuitem">Archive</button></div>', 'menu-item-size')).length, 0)
  assert.equal((await issues('<div data-menu class="menu"><a href="/a" style="min-height:30px">Billing</a><a href="/b">Account</a></div>', 'menu-item-size')).length, 1, 'a project marks its menu of links with data-menu')
})

test('menu-item-boxed: a row with a border is reported', async () => {
  const boxed = await issues('<div role="menu" class="menu"><button role="menuitem" style="border:1px solid #888">Rename</button><button role="menuitem" style="border:1px solid #888">Archive</button></div>', 'menu-item-boxed')
  assert.equal(boxed.length, 1, JSON.stringify(boxed))
  assert.equal((await issues('<div role="menu" class="menu"><button role="menuitem">Rename</button><button role="menuitem">Archive</button></div>', 'menu-item-boxed')).length, 0)
})

test('menu-role-links: a menu role over links is reported; over buttons, or a disclosure with no role, it is not', async () => {
  assert.equal((await issues('<div role="menu" class="menu"><a role="menuitem" href="/a">Billing</a><a role="menuitem" href="/b">Account</a></div>', 'menu-role-links')).length, 1)
  assert.equal((await issues('<div role="menu" class="menu"><button role="menuitem">Rename</button><a role="menuitem" href="/b">Open</a></div>', 'menu-role-links')).length, 0)
  assert.equal((await issues('<div data-menu class="menu"><a href="/a">Billing</a><a href="/b">Account</a></div>', 'menu-role-links')).length, 0, 'links in a disclosure are the right pattern')
})

test('menu-icons-uneven: a group where some items have an icon and some do not is reported; all or none is not', async () => {
  const uneven = await issues('<div data-menu class="menu"><ul style="margin:0;padding:0;list-style:none"><li><a href="/a">' + svg + 'Billing</a></li><li><a href="/b">Account</a></li></ul></div>', 'menu-icons-uneven')
  assert.equal(uneven.length, 1, JSON.stringify(uneven))
  assert.equal((await issues('<div data-menu class="menu"><ul style="margin:0;padding:0;list-style:none"><li><a href="/a">' + svg + 'Billing</a></li><li><a href="/b">' + svg + 'Account</a></li></ul></div>', 'menu-icons-uneven')).length, 0)
  assert.equal((await issues('<div data-menu class="menu"><ul style="margin:0;padding:0;list-style:none"><li><a href="/a">Billing</a></li><li><a href="/b">Account</a></li></ul></div>', 'menu-icons-uneven')).length, 0)
  assert.equal((await issues('<div data-menu class="menu"><ul style="margin:0;padding:0;list-style:none"><li><a href="/a">' + svg + 'Billing</a></li></ul><ul style="margin:0;padding:0;list-style:none"><li><a href="/b">Account</a></li><li><a href="/c">Plan</a></li></ul></div>', 'menu-icons-uneven')).length, 0, 'each group is its own: one with icons and one without is allowed')
})

test('nav-overflow: a column of links that scrolls up and down is not a cut; a link cut at the side still is', async () => {
  const column = '<nav style="width:240px;height:120px;overflow-y:auto;margin:20px"><div style="display:grid"><a href="#" style="height:48px">One</a><a href="#" style="height:48px">Two</a><a href="#" style="height:48px">Three</a><a href="#" style="height:48px">Four</a></div></nav>'
  assert.equal((await issues(column, 'nav-overflow')).length, 0, 'a sidebar that scrolls keeps every row reachable')
  const sideways = '<nav style="width:120px;overflow-y:auto;margin:20px"><div style="display:flex;width:400px"><a href="#" style="flex:none;width:200px">One</a><a href="#" style="flex:none;width:200px">Two</a></div></nav>'
  assert.equal((await issues(sideways, 'nav-overflow')).length, 1, 'a link cut at the side is')
})
