import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'
import { audit } from '../src/audit.ts'

let browser: Browser
let page: Page
before(async () => {
  browser = await chromium.launch()
  page = await browser.newPage({ viewport: { width: 600, height: 600 } })
})
after(async () => { await browser?.close() })
const read = async (html: string, type: string) => {
  await page.setContent('<style>body{margin:0;padding:16px;font:16px/24px sans-serif}p{margin:4px 0;font:14px/20px sans-serif;width:360px}input,textarea{display:block;height:44px;width:360px}</style>' + html)
  return (await page.evaluate(audit, { comfortable: 32 })).filter((i) => i.type === type)
}
const field = (id: string, hint: string, extra = '') => '<label for="' + id + '">Name</label><p id="' + id + '-hint"' + extra + '>' + hint + '</p><input id="' + id + '" aria-describedby="' + id + '-hint">'

test('hint-length: one short sentence is a hint, two sentences or a long one are not', async () => {
  const issues = await read(
    field('short', 'Use the name on your passport') +
    field('two', 'Use your name. We show it on the receipt') +
    field('long', 'Use the name on your passport or your driving licence, exactly as it is printed, with every middle name') +
    field('long-end', 'Use the name on your passport'.padEnd(120, ' x')),
    'hint-length')
  assert.deepEqual(issues.map((i) => i.selector).sort(), ['#long-end-hint', '#long-hint', '#two-hint'])
})

test('hint-length: e.g. does not end a sentence, an error message and a hidden hint are not hints', async () => {
  const issues = await read(
    field('abbr', 'Name what to keep, e.g. the dog or the guitar') +
    field('error', 'Enter your name. It is how we address you. It is shown on every receipt we send you.', ' role="alert"') +
    field('hidden', 'One. Two. Three.', ' hidden'),
    'hint-length')
  assert.deepEqual(issues, [])
})

test('hint-link: a link in a hint is flagged', async () => {
  const issues = await read(field('link', 'See the <a href="#">guide</a> for the format') + field('plain', 'Use the format in the guide'), 'hint-link')
  assert.deepEqual(issues.map((i) => i.selector), ['#link-hint'])
})

test('hint-length: a description of a button or a dialog is not a field hint', async () => {
  const issues = await read('<p id="d">One long explanation. Another sentence. And a third one that goes on and on and on for a very long time, past ninety characters.</p><button aria-describedby="d">Go</button>', 'hint-length')
  assert.deepEqual(issues, [])
})

test('field-row-align: fields in one row start their controls on one line, with the same parts above them', async () => {
  const row = (a: string, b: string) => '<div style="display:flex;gap:16px"><div style="width:200px">' + a + '</div><div id="second" style="width:200px">' + b + '</div></div>'
  const field = (id: string, hint = '') => '<label for="' + id + '">Name</label>' + (hint ? '<p style="margin:0">' + hint + '</p>' : '') + '<input id="' + id + '" style="display:block;width:100%;height:44px">'
  assert.deepEqual((await read(row(field('a', 'A hint'), field('b')), 'field-row-align')).map((i) => i.selector), ['#second'])
  assert.deepEqual(await read(row(field('c', 'A hint'), field('d', 'A hint')), 'field-row-align'), [])
  assert.deepEqual(await read(field('e', 'One') + field('f'), 'field-row-align'), [])
})

test('field-row-wide: a text area or a drop area is not beside another field, short fields may be', async () => {
  const row = (a: string, b: string) => '<div style="display:flex;gap:16px"><div id="first" style="width:200px">' + a + '</div><div style="width:200px">' + b + '</div></div>'
  const input = (id: string) => '<label for="' + id + '">Field</label><input id="' + id + '" style="display:block;width:100%;height:44px">'
  const area = (id: string) => '<label for="' + id + '">Notes</label><textarea id="' + id + '" style="display:block;width:100%;height:80px"></textarea>'
  const file = (id: string) => '<label for="' + id + '">File</label><input type="file" id="' + id + '" style="position:absolute;width:1px;height:1px;opacity:0"><label for="' + id + '" style="display:block;height:120px;border:1px dashed">Click to upload</label>'
  assert.deepEqual((await read(row(area('g'), input('h')), 'field-row-wide')).map((i) => i.selector), ['#first'])
  assert.equal((await read(row(input('i'), file('j')), 'field-row-wide')).length, 1)
  assert.deepEqual(await read(row(input('k'), input('l')), 'field-row-wide'), [])
})


