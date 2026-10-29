import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'
import { audit } from '../src/audit.ts'

let browser: Browser
let page: Page
before(async () => {
  browser = await chromium.launch()
  page = await browser.newPage({ viewport: { width: 390, height: 600 } })
})
after(async () => { await browser?.close() })
const read = async (html: string, type: string) => {
  await page.setContent('<style>body{margin:0;font:16px/24px sans-serif}button{min-height:44px} :focus-visible{outline:2px solid blue}</style>' + html)
  return (await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === type)
}

test('audit uses inline fragments, not the empty corners of wrapped link bounds', async () => {
  const issues = await read('<p style="width:230px;margin:24px"><a id="first" href="#">Read the complete terms of service</a> and <a id="second" href="#">privacy policy</a>.</p>', 'control-overlap')
  assert.deepEqual(issues, [])
  const collisions = await read('<div style="position:relative;margin:24px"><a href="#">First link</a><a id="collision" href="#" style="position:absolute;left:12px;top:0">Other link</a></div>', 'control-overlap')
  assert.deepEqual(collisions.map((i) => i.selector), ['#collision'])
})

test('audit lets prose links wrap while retaining short navigation label checks', async () => {
  const issues = await read('<p style="width:90px;margin:24px">Read <a href="#">Privacy policy details</a> today.</p><nav style="display:flex;width:90px;margin:24px"><a id="navigation" href="#">Privacy policy details</a></nav>', 'label-wraps')
  assert.deepEqual(issues.map((i) => i.selector), ['#navigation'])
})

test('audit allows vertical navigation titles to wrap, but not horizontal navigation labels', async () => {
  const issues = await read('<nav style="width:120px"><ol><li><a href="#">A longer chapter title</a></li></ol></nav>' +
    '<nav style="width:120px"><ul style="display:flex;list-style:none;padding:0"><li><a id="horizontal" href="#">A longer chapter title</a></li></ul></nav>' +
    '<nav style="width:120px"><a id="plain-horizontal" href="#">A longer chapter title</a></nav>', 'label-wraps')
  assert.deepEqual(issues.map((i) => i.selector), ['#horizontal', '#plain-horizontal'])
})

test('audit allows a fitted multiline region disclosure, not clipped questions or popup buttons', async () => {
  const button = (id: string, extra: string) => `<button id="${id}" aria-expanded="false" style="display:flex;width:180px;text-align:left;padding:16px;${extra}"><span>How do annual renewals work?</span></button>`
  const issues = await read(button('question', '') + button('clipped', 'height:44px;overflow:hidden') +
    button('popup', '').replace('id="popup"', 'id="popup" aria-haspopup="menu"'), 'label-wraps')
  assert.deepEqual(issues.map((i) => i.selector), ['#clipped', '#popup'])
})

test('audit gives sentence links the inline-target exception without exempting standalone links', async () => {
  const issues = await read('<ul><li>Read the <a href="#" style="font-size:12px">short guide</a> for details.</li></ul>' +
    '<div><a id="small" href="#" style="font-size:12px">Go</a><button style="padding:0;width:44px">Next</button></div>', 'tap-target')
  assert.ok(!issues.some((i) => i.text === 'short guide'))
  assert.ok(issues.some((i) => i.selector === '#small' && i.severity === 'error'))
})

test('tap-spacing: a row that a scrolling list clips is not close to the button below the list, a row that shows is', async () => {
  const list = (overflow: string) => '<div style="height:100px;overflow:' + overflow + '"><a href="#" style="display:block;height:140px">Row</a></div><button id="below" style="display:block;margin-top:10px;padding:0 16px">Below</button>'
  assert.deepEqual((await read(list('auto'), 'tap-spacing')).map((i) => i.selector), [])
  assert.deepEqual((await read(list('visible'), 'tap-spacing')).map((i) => i.selector), ['#below'])
})

test('tap-target: a 44px control that measures 43.99999px while it animates in is not small, a 40px one is', async () => {
  await page.setContent('<style>body{margin:0;font:16px/24px sans-serif}button{padding:0;width:80px;height:44px}</style><button id="noise" style="transform:scale(0.999999)">Go</button><button id="small" style="height:40px">Go</button>')
  const issues = (await page.evaluate(audit, { comfortable: 44 })).filter((i) => i.type === 'tap-target')
  assert.deepEqual(issues.map((i) => i.selector), ['#small'])
})

test('explicit pretty content titles can wrap only when their full text fits outside compact navigation', async () => {
  const button = (id: string, style = '') => `<button id="${id}" style="width:120px;font:14px/21px sans-serif;text-align:left;text-wrap:pretty;${style}">A longer content title</button>`
  const issues = await read(button('content') + button('clipped', 'height:30px;min-height:0;overflow:hidden') +
    `<nav>${button('nav')}</nav>` + button('ordinary', 'text-wrap:wrap'), 'label-wraps')
  assert.deepEqual(issues.map((i) => i.selector), ['#clipped', '#nav', '#ordinary'])
})

test('tooltip copy is not a trigger label, while an actual wrapped label with the same description still fails', async () => {
  const tooltip = (id: string, opacity: number) => `<span id="${id}" role="tooltip" style="position:absolute;width:90px;white-space:normal;opacity:${opacity}">Model provenance with a detailed description that naturally uses several lines</span>`
  const icon = (id: string, opacity: number) => `<a id="${id}" href="#" aria-label="Model details" aria-describedby="${id}-hint" style="display:inline-flex;width:44px;height:44px"><svg aria-hidden="true" width="20" height="20"><circle cx="10" cy="10" r="8"/></svg>${tooltip(id + '-hint', opacity)}</a>`
  const issues = await read(icon('hidden-hint', 0) + icon('visible-hint', 1) +
    `<button id="wrapped-label" aria-describedby="wrapped-hint" style="width:90px;font:14px/21px sans-serif">Use this longer action${tooltip('wrapped-hint', 0)}</button>`, 'label-wraps')
  assert.deepEqual(issues.map((i) => i.selector), ['#wrapped-label'])
})

test('audit measures associated native choice labels, not their compact checkbox and radio artwork', async () => {
  const issues = await read('<style>label{display:flex;align-items:center;width:240px;min-height:44px}input{width:18px;height:18px}</style>' +
    '<label><input id="wrapped" type="checkbox">Keep audio</label>' +
    '<input id="external" type="radio" name="choice"><label for="external">First choice</label>' +
    '<label><input id="disabled" type="checkbox" disabled>Unavailable choice</label>', 'tap-target')
  assert.deepEqual(issues, [])
})

test('audit does not borrow hidden, mismatched or noninteractive choice labels as hit areas', async () => {
  const issues = await read('<style>label{display:block;width:240px;height:44px}input{display:block;width:18px;height:18px;margin:24px}</style>' +
    '<input id="hidden-label" type="checkbox"><label for="hidden-label" style="display:none">Hidden</label>' +
    '<input id="mismatched-label" type="checkbox"><label for="another-id">Different control</label>' +
    '<input id="inert-label" type="radio"><label for="inert-label" style="pointer-events:none">Not a hit area</label>' +
    '<input id="clipped-label" type="checkbox"><label for="clipped-label" style="position:absolute;clip-path:inset(50%)">Clipped</label>' +
    '<input id="overflow-label" type="checkbox"><div style="width:20px;overflow:hidden"><label for="overflow-label">Only twenty pixels visible</label></div>', 'tap-target')
  assert.deepEqual(issues.map((i) => i.selector), ['#hidden-label', '#mismatched-label', '#inert-label', '#clipped-label', '#overflow-label'])
})

test('audit retains close-target spacing checks around an associated choice label', async () => {
  const issues = await read('<label style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px"><input id="close-choice" type="checkbox" aria-label="Select" style="width:18px;height:18px"></label>' +
    '<button style="width:44px;margin-left:-4px">Next</button>', 'tap-spacing')
  assert.ok(issues.some((issue) => issue.selector === '#close-choice'))
})

test('tap targets exclude fully scroll-clipped choices, not small visible choices or below-window controls', async () => {
  await page.setContent('<style>body{margin:0;font:16px sans-serif}label{display:flex;align-items:center;min-height:44px}input{width:18px;height:18px}</style>' +
    '<div id="scroll" style="height:100px;overflow:auto"><div style="height:120px"></div><label><input id="valid" type="checkbox">Full choice target</label><input id="small-scrolled" type="checkbox" aria-label="Small choice"></div>' +
    '<input id="small-visible" type="checkbox" aria-label="Small visible choice"><div style="height:650px"></div><input id="below-window" type="checkbox" aria-label="Below window">')
  const before = (await page.evaluate(audit, { comfortable: 44 })).filter((i) => i.type === 'tap-target')
  assert.deepEqual(before.map((i) => i.selector), ['#small-visible', '#below-window'])
  await page.locator('#scroll').evaluate((el) => { el.scrollTop = el.scrollHeight })
  const after = (await page.evaluate(audit, { comfortable: 44 })).filter((i) => i.type === 'tap-target')
  assert.ok(!after.some((i) => i.selector === '#valid'))
  assert.ok(after.some((i) => i.selector === '#small-scrolled'))
  assert.ok(after.some((i) => i.selector === '#small-visible'))
})

test('partially scroll-clipped native choice rows keep their revealable hit size, unlike permanent clips', async () => {
  const row = (id: string, overflow: string, height: number) => `<div style="height:${height}px;overflow:hidden;width:240px;margin:20px"><div style="height:100%;overflow:${overflow}"><div style="height:60px"></div><label style="display:flex;align-items:center;height:44px"><input id="${id}" type="checkbox" style="width:18px;height:18px">Choice</label></div></div>`
  const issues = await read(row('scroll-choice', 'auto', 90) + row('permanent-choice', 'hidden', 90) + row('tiny-scrollport', 'auto', 30).replace('height:60px', 'height:0px'), 'tap-target')
  assert.ok(!issues.some((i) => i.selector === '#scroll-choice'))
  assert.ok(issues.some((i) => i.selector === '#permanent-choice'))
  assert.ok(issues.some((i) => i.selector === '#tiny-scrollport'))
  assert.deepEqual(await page.locator('div[style*="height:100%"]') .evaluateAll((nodes) => nodes.map((n) => n.scrollTop)), [0, 0, 0])
})

test('audit ignores offscreen rail descendants behind nested clips but retains a visibly cut edge label', async () => {
  const issues = await read('<div style="display:flex;width:350px;margin:20px;overflow-x:auto">' +
    '<article style="width:400px;flex:none">First card</article><article style="width:220px;flex:none"><span style="display:block;width:180px;overflow:hidden;white-space:nowrap"><span id="offscreen">Offscreen model title →</span></span></article></div>' +
    '<div style="position:absolute;left:370px;width:20px;overflow:hidden"><span id="cut-label" style="white-space:nowrap">Visible text cut at the edge</span></div>', 'clipped')
  assert.deepEqual(issues.map((i) => i.selector), ['#cut-label'])
})

test('audit does not call a tile cut by the edge of a scroller clipped text, even when the tile has a clip of its own', async () => {
  const issues = await read('<div style="display:flex;gap:8px;width:350px;margin:20px;overflow-x:auto">' +
    '<span style="flex:none;width:200px;overflow:hidden">First tile</span><span style="flex:none;width:200px;overflow:hidden;position:relative"><span id="half-tile" style="white-space:nowrap">Second tile text that crosses the edge</span></span></div>', 'clipped')
  assert.deepEqual(issues.map((i) => i.selector), [])
})

test('audit accepts an input action only within its reserved padding, not over editable text', async () => {
  const field = (id: string, padding: number, side: 'left' | 'right' = 'right') => `<div style="position:relative;width:260px;margin:20px"><input id="${id}" type="password" value="Some text" style="box-sizing:border-box;width:100%;height:44px;padding-${side}:${padding}px"><button id="${id}-action" aria-label="Reveal" style="position:absolute;${side}:0;top:0;width:44px;height:44px">●</button></div>`
  const issues = await read(field('valid', 44) + field('invalid', 12) + field('left', 44, 'left'), 'control-overlap')
  assert.deepEqual(issues.map((i) => i.selector), ['#invalid-action'])
})

test('touch spacing recognises a reserved input action but retains genuinely close neighbours', async () => {
  const field = (id: string, padding: number, side: 'left' | 'right' = 'right') => `<div style="position:relative;width:260px;margin:20px"><input id="${id}" type="text" value="A selected country" style="box-sizing:border-box;width:100%;height:44px;padding-${side}:${padding}px"><button id="${id}-action" aria-label="Open choices" style="position:absolute;${side}:0;top:0;width:44px;height:44px">⌄</button></div>`
  const issues = await read(field('reserved', 52) + field('intruding', 12) + field('start', 52, 'left') +
    '<div style="margin:20px"><button id="neighbour-one" style="width:44px">One</button><button id="neighbour-two" style="width:44px">Two</button></div>', 'tap-spacing')
  assert.ok(!issues.some((i) => ['#reserved', '#reserved-action', '#start', '#start-action'].includes(i.selector)))
  assert.ok(issues.some((i) => i.selector === '#intruding-action'))
  assert.ok(issues.some((i) => i.selector === '#neighbour-one' || i.selector === '#neighbour-two'))
})

test('audit ignores transparent hints and fully clipped accessible inputs, but not visible overflow', async () => {
  const issues = await read('<div style="opacity:0"><span style="position:absolute;left:-60px">Hidden hint</span></div>' +
    '<input type="file" style="position:absolute;width:200px;height:80px;left:-80px;clip-path:inset(50%)">' +
    '<div style="clip:rect(0px,0px,0px,0px);position:absolute"><span style="position:absolute;left:-60px">Hidden clipped child</span></div>' +
    '<p id="visible-overflow" style="position:absolute;left:-12px">Visible edge problem</p>', 'overflow')
  assert.deepEqual(issues.map((i) => i.selector), ['#visible-overflow'])
})

test('text margins use painted text, not invisible tooltip descendants of a visible button', async () => {
  const issues = await read('<button style="position:relative;margin:24px;width:100px">Reference<span style="position:absolute;left:-24px;opacity:0">Hidden tooltip at the edge</span></button><p id="edge" style="margin:0 4px">Visible edge text</p>', 'edge-margin')
  assert.deepEqual(issues.map((i) => i.selector), ['#edge'])
})

test('audit excludes zero-clipped labels without hiding visible positioned descendants or top-layer dialogs', async () => {
  await page.setContent('<style>body{margin:0;font:16px sans-serif}.label{display:block;width:60px}</style>' +
    '<div style="position:absolute;left:-9999px;width:0;height:0;overflow:hidden"><label class="label">Hidden field label</label><input type="text"></div>' +
    '<div style="width:0;height:0;overflow:hidden"><label id="escaped" class="label" style="position:absolute;left:20px;top:200px">Visible field label</label></div>' +
    '<div style="width:0;height:0;overflow:hidden"><dialog><label id="dialog-label" class="label">Visible dialog label</label></dialog></div>')
  assert.deepEqual((await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === 'label-wraps').map((i) => i.selector), ['#escaped'])
  await page.locator('dialog').evaluate((el) => (el as HTMLDialogElement).showModal())
  assert.deepEqual((await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === 'label-wraps').map((i) => i.selector), ['#escaped', '#dialog-label'])
})

test('audit recognises native modal top layers without requiring aria-modal', async () => {
  await page.setContent('<style>body{margin:0;font:16px sans-serif}header{position:fixed;top:0;left:0;width:100%;height:80px;background:black;color:white}dialog{margin:12px auto;width:300px}h1{margin:0}</style>' +
    '<header>Background navigation</header><button>Behind dialog</button><dialog id="modal"><h1>Dialog heading</h1><button>Close dialog</button></dialog>')
  await page.locator('#modal').evaluate((el) => (el as HTMLDialogElement).showModal())
  assert.deepEqual((await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === 'under-top-bar'), [])
})

test('audit selects the native modal opened last even when its document order is first', async () => {
  await page.setContent('<style>body{margin:0;font:16px sans-serif}dialog{margin:12px auto;width:300px}header{position:fixed;top:0;left:0;width:100%;height:80px;background:black;color:white}</style>' +
    '<header>Background navigation</header><dialog id="front"><h1>Front dialog</h1><button>Front action</button></dialog><dialog id="back"><header>Back dialog header</header><button>Back action</button></dialog>')
  await page.locator('#back').evaluate((el) => (el as HTMLDialogElement).showModal())
  await page.locator('#front').evaluate((el) => (el as HTMLDialogElement).showModal())
  const issues = await page.evaluate(audit, { comfortable: 32 })
  assert.deepEqual(issues.filter((i) => i.type === 'under-top-bar'), [])
})

test('audit selects a native dialog nested inside an older ARIA modal', async () => {
  await page.setContent('<div aria-modal="true" role="dialog"><button>Old action</button><button style="margin-left:-30px">Old overlapping action</button><dialog><h1>Current dialog</h1><button>Current action</button></dialog></div>')
  await page.locator('dialog').evaluate((el) => (el as HTMLDialogElement).showModal())
  assert.deepEqual((await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === 'control-overlap'), [])
})

test('audit checks paint order: a menu in front of a header is not hidden under it', async () => {
  const issues = await read('<header style="position:fixed;top:0;left:0;width:100%;height:80px;z-index:10;background:black;color:white">Navigation</header>' +
    '<nav style="position:absolute;top:12px;left:20px;z-index:20;background:white"><button id="menu">Open menu</button></nav>' +
    '<p id="covered" style="margin:0;padding-top:15px">Content actually behind the header</p>', 'under-top-bar')
  assert.deepEqual(issues.map((i) => i.selector), ['#covered'])
})

test('audit still finds a covering bar when it has pointer-events:none', async () => {
  const issues = await read('<header style="position:fixed;top:0;left:0;width:100%;height:80px;z-index:10;background:black;color:white;pointer-events:none">Navigation</header><p id="covered" style="margin:0;padding-top:20px">Covered content</p>', 'under-top-bar')
  assert.deepEqual(issues.map((i) => i.selector), ['#covered'])
  assert.equal(await page.locator('header').evaluate((el) => (el as HTMLElement).style.pointerEvents), 'none')
})

test('audit does not invent coverage in the unpainted space of a transparent fixed bar', async () => {
  const issues = await read('<header style="position:fixed;top:0;left:0;width:100%;height:80px;z-index:10;pointer-events:none"><button style="position:absolute;right:12px;width:60px">Menu</button></header><p style="margin:0;padding-top:12px;width:180px">Uncovered text</p>', 'under-top-bar')
  assert.deepEqual(issues, [])
})

test('audit allows a stretched transparent row action, not overlapping painted or adjacent controls', async () => {
  const good = '<div style="position:relative;width:300px;height:60px;margin:24px"><button aria-label="Open row" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent"></button><a style="position:relative;z-index:1" href="#">Details</a></div>'
  assert.deepEqual(await read(good, 'control-overlap'), [])
  const bad = good.replace('background:transparent', 'background:red')
  assert.equal((await read(bad, 'control-overlap')).length, 1)
  const blocked = good.replace('inset:0;width:100%', 'inset:0;z-index:2;width:100%')
  assert.equal((await read(blocked, 'control-overlap')).length, 1)
  assert.deepEqual(await read('<div style="height:900px"></div>' + good, 'control-overlap'), [])
  assert.equal(await page.evaluate(() => scrollY), 0)
  const adjacent = '<div style="position:relative;margin:24px"><button aria-label="Empty" style="position:absolute;width:100px;height:50px;border:0;background:transparent"></button><button style="position:absolute;left:80px;width:100px;height:50px">Neighbour</button></div>'
  assert.equal((await read(adjacent, 'control-overlap')).length, 1)
})

test('audit does not exempt an empty overlay painted by its pseudo element', async () => {
  const issues = await read('<style>#painted::before{content:"";position:absolute;inset:0;background:red}</style><div style="position:relative;width:300px;height:60px;margin:24px"><button id="painted" aria-label="Open row" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent"></button><a style="position:relative;z-index:1" href="#">Details</a></div>', 'control-overlap')
  assert.equal(issues.length, 1)
})

test('touch spacing accepts a reachable secondary link above its own empty row action, not blocked or neighbouring controls', async () => {
  const row = '<div style="position:relative;width:300px;height:44px;margin:24px"><button aria-label="Open row" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent"></button><a id="secondary" href="#" style="position:relative;z-index:1;display:inline-flex;align-items:center;width:100px;height:44px">Details</a></div>'
  assert.deepEqual(await read(row, 'tap-spacing'), [])
  assert.ok((await read(row.replace('inset:0;width:100%', 'inset:0;z-index:2;width:100%'), 'tap-spacing')).length > 0)
  assert.ok((await read(row.replace('background:transparent', 'background:red'), 'tap-spacing')).length > 0)
  assert.ok((await read('<button style="width:44px">One</button><button style="width:44px">Two</button>', 'tap-spacing')).length > 0)
})

test('audit retains overlap detection inside a modal while ignoring clipped content outside its scroll port', async () => {
  await page.setContent('<style>dialog{width:300px;height:200px;overflow:auto}button{width:100px;height:44px}</style><dialog id="dialog"><button>First</button><button id="collision" style="margin-left:-30px">Second</button><div style="width:100px;overflow:hidden"><a href="#" style="position:relative;left:150px">Clipped link</a></div></dialog>')
  await page.locator('dialog').evaluate((el) => (el as HTMLDialogElement).showModal())
  assert.deepEqual((await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === 'control-overlap').map((i) => i.selector), ['#collision'])
})
