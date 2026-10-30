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

