import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'
import { boxes, compareBoxes } from '../src/boxes.ts'
import { lookAt, texts } from '../src/looks.ts'

let browser: Browser
let page: Page
before(async () => {
  browser = await chromium.launch()
  page = await browser.newPage({ viewport: { width: 600, height: 600 } })
})
after(async () => {
  await browser?.close()
})
const STYLE = '<style>body{margin:0;font:16px/24px sans-serif}p{margin:0}</style>'
const read = async <T>(html: string, fn: (p: string) => T[], prefix = 'x') => {
  await page.setContent(STYLE + html)
  return page.evaluate(fn, prefix) as Promise<T[]>
}
const looks = async (html: string) => (await read(html, texts as never)) as ReturnType<typeof texts>
const layout = async (html: string) => (await read(html, boxes)) as ReturnType<typeof boxes>

test('look reports text drawn differently, once per kind of difference, and leaves data alone', async () => {
  const design = await looks('<h2 style="font-size:20px">Plan</h2><p style="color:#fff">Credits</p><p style="color:#fff">Renews monthly</p><p>Only in the design</p>')
  const app = await looks('<h2 style="font-size:24px">Plan</h2><p style="color:#fff">Credits</p><p style="color:#aaa">Renews monthly</p><p>Only in the app</p>')
  const found = lookAt(design, app)
  assert.equal(found.matched, 3)
  assert.deepEqual(found.differences.map((d) => d.what), ['size 20px in the design, 24px in the app', 'colour rgba(255, 255, 255, 1) in the design, rgba(170, 170, 170, 1) in the app'])
  assert.deepEqual(found.onlyApp, ['Only in the app'])
  assert.deepEqual(found.onlyDesign, ['Only in the design'])
})

test('look pairs the nth time a phrase appears with the nth time, and groups repeated differences', async () => {
  const design = await looks('<p style="font-weight:600">Open</p><p>Open</p><p style="font-weight:600">Open</p>')
  const app = await looks('<p>Open</p><p>Open</p><p>Open</p>')
  const found = lookAt(design, app)
  assert.equal(found.matched, 3)
  assert.equal(found.differences.length, 1)
  assert.equal(found.differences[0]!.count, 2)
})

test('look reads a phrase split into several text nodes as one', async () => {
  const design = await looks('<p>Hello Ana</p>')
  const app = await looks('<p id="a">Hello </p><script>document.getElementById("a").append("Ana")</script>')
  assert.equal(lookAt(design, app).matched, 1)
})

test('look ignores the fallback fonts after the first, text that is not shown, and lengths within a hair', async () => {
  const design = await looks('<p style="font-family:serif,Arial;letter-spacing:normal">Same words</p><p style="display:none">Hidden words</p>')
  const app = await looks('<p style="font-family:serif,Courier;letter-spacing:0px">Same words</p><p style="font-size:20px;opacity:0">Hidden words</p>')
  const found = lookAt(design, app)
  assert.equal(found.matched, 1)
  assert.deepEqual(found.differences, [])
})

test('geometry reports a box that is narrower, and text that moved under its icon', async () => {
  const design = await layout('<div data-x="card" style="display:flex;gap:8px;width:300px"><span data-x="icon" style="width:24px;height:24px;display:block"></span><p>Title</p></div>')
  const app = await layout('<div data-x="card" style="width:260px"><span data-x="icon" style="width:24px;height:24px;display:block"></span><p>Title</p></div>')
  const found = compareBoxes(design, app)
  assert.ok(found.mismatches.some((m) => m.type === 'size' && m.message.includes('card')), JSON.stringify(found.mismatches))
  assert.ok(found.mismatches.some((m) => m.type === 'arrangement' && m.message.includes('“Title”')), JSON.stringify(found.mismatches))
})

test('geometry reports the space between neighbours, not their absolute height', async () => {
  const design = await layout('<p style="margin-bottom:8px">First paragraph</p><p>Second paragraph</p>')
  const sameGap = await layout('<div style="height:200px"></div><p style="margin-bottom:8px">First paragraph</p><p>Second paragraph</p>')
  assert.deepEqual(compareBoxes(design, sameGap).mismatches, [])
  const tight = await layout('<p style="margin-bottom:24px">First paragraph</p><p>Second paragraph</p>')
  const found = compareBoxes(design, tight)
  assert.deepEqual(found.mismatches.map((m) => m.type), ['gap'])
  // The gap is between the text itself (the glyph boxes), so it is the margin plus the leading around each line, which
  // depends on the font of the machine; what the margins decide is the difference of 24px against 8px.
  const [, inApp, inDesign] = /(\d+)px in the app, (\d+)px in the design/.exec(found.mismatches[0]!.message) ?? []
  assert.equal(Number(inApp) - Number(inDesign), 16, found.mismatches[0]!.message)
  assert.match(found.mismatches[0]!.message, /^between “First paragraph” and “Second paragraph”: /)
})

test('geometry does not blame a box for being pushed sideways by text only one page has', async () => {
  const row = (name: string) => `<div style="display:flex;justify-content:flex-end;width:500px"><span>English</span><span>${name}</span></div>`
  const found = compareBoxes(await layout(row('Ana')), await layout(row('Alexandra Petrova')))
  assert.deepEqual(found.mismatches, [])
  assert.equal(found.matched, 1)
})

test('geometry compares only the boxes that keep their order when a list shows the same items another way', async () => {
  const list = (items: string[]) => items.map((t) => `<div data-x="card"><p>${t}</p></div>`).join('')
  const found = compareBoxes(await layout(list(['Alpha', 'Beta', 'Gamma'])), await layout(list(['Beta', 'Alpha', 'Gamma'])))
  // Alpha and Gamma keep their order; Beta moved, so its card and title are left out (4 of 6 boxes).
  assert.equal(found.matched, 4)
})

test('geometry knows a picture by the title under it', async () => {
  const card = (title: string, size: number) => `<div><div data-x="media" style="width:${size}px;height:${size}px"></div><p>${title}</p></div>`
  const found = compareBoxes(await layout(card('One', 100) + card('Two', 50)), await layout(card('Two', 50) + card('One', 100)))
  assert.deepEqual(found.mismatches.filter((m) => m.type === 'size'), [])
})

test('look keeps the same words apart when they stand in different components', async () => {
  const design = await looks('<div data-x="label"><span>Models</span></div><div data-x="badge"><span style="font-weight:700">Models</span></div>')
  const app = await looks('<div data-x="badge"><span style="font-weight:700">Models</span></div><div data-x="label"><span>Models</span></div>')
  const found = lookAt(design, app)
  assert.equal(found.matched, 2)
  assert.deepEqual(found.differences, [])
})

test('look compares alignment only where text runs over several lines', async () => {
  const design = await looks('<p style="width:200px;text-align:left">One short line</p><p style="width:100px;text-align:left">A longer text that runs over several lines</p>')
  const app = await looks('<p style="width:200px;text-align:center">One short line</p><p style="width:100px;text-align:center">A longer text that runs over several lines</p>')
  assert.deepEqual(lookAt(design, app).differences.map((d) => d.what), ['alignment start in the design, center in the app'])
})

test('geometry leaves out text kept for screen readers: a box a pixel wide with its overflow cut away', async () => {
  const table = (caption: string) => '<div style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)"><table><caption>' + caption + '</caption></table></div><p>Visible words here</p>'
  const lead = 'A caption long enough to share its first forty characters'
  const same = compareBoxes(await layout(table(lead)), await layout(table(lead + ' and then a very much longer ending')))
  assert.equal(same.matched, 1, 'only the visible text is a box')
  assert.deepEqual(same.mismatches, [])
})

test('geometry leaves figures alone: a pager with more pages does not move its label', async () => {
  const pager = (pages: number[]) => '<div style="display:flex;justify-content:flex-end;width:500px"><span>Previous</span>' + pages.map((n) => '<span>' + n + '</span>').join('') + '</div>'
  const found = compareBoxes(await layout(pager([1, 2])), await layout(pager([1, 2, 3, 4])))
  assert.deepEqual(found.mismatches, [])
})

test('geometry compares only the width of a component that holds text the other page lacks', async () => {
  const panel = (rows: string[]) => '<div data-x="panel" style="width:300px"><p>A title that is long enough to name this panel</p>' + rows.map((r) => '<p>' + r + '</p>').join('') + '</div>'
  const found = compareBoxes(await layout(panel(['Alpha row'])), await layout(panel(['Alpha row', 'Beta row', 'Gamma row'])))
  assert.deepEqual(found.mismatches, [])
  const narrow = await layout(panel(['Alpha row']).replace('300px', '260px'))
  assert.ok(compareBoxes(await layout(panel(['Alpha row'])), narrow).mismatches.some((m) => m.type === 'size'))
})
