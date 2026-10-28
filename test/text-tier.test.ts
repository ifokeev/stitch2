import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'
import { audit } from '../src/audit.ts'

let browser: Browser
let page: Page
before(async () => {
  browser = await chromium.launch()
  page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
})
after(async () => { await browser?.close() })

const SENTENCE = 'Add your clips, then ask for the edit: cut the pauses, add captions, change the music and make it vertical.'
const MUTED = 'rgba(255, 255, 255, 0.77)'
const read = async (html: string, secondary = 'var(--tone-muted)') => {
  await page.setContent('<style>:root{--tone-muted:' + MUTED + ';--tone-body:rgba(255,255,255,0.85)}body{margin:0;padding:24px;background:#101010;font:15px/24px sans-serif;color:var(--tone-body)}.quiet{color:var(--tone-muted)}</style>' + html)
  return (await page.evaluate(audit, { comfortable: 32, secondary })).filter((i) => i.type === 'text-tier')
}

test('text-tier: a sentence of reading copy in the secondary colour is a warning, in the body colour it is not', async () => {
  const found = await read('<p id="intro" class="quiet">' + SENTENCE + '</p><p id="fine">' + SENTENCE + '</p>')
  assert.deepEqual(found.map((i) => i.selector), ['#intro'])
  assert.equal(found[0]!.severity, 'warning')
})

test('text-tier: hints, counts and short lines may be secondary, and so may text in a bar, a table, a control or a link', async () => {
  const found = await read(
    '<p class="quiet">Sign up to send.</p><p class="quiet">12 clips · 4 min</p>' +
      '<nav class="quiet">' + SENTENCE + '</nav><footer class="quiet">' + SENTENCE + '</footer>' +
      '<table><tr><td class="quiet">' + SENTENCE + '</td></tr></table>' +
      '<button class="quiet">' + SENTENCE + '</button><label class="quiet">' + SENTENCE + '</label>' +
      '<p><a class="quiet" href="#">' + SENTENCE + '</a></p>',
  )
  assert.deepEqual(found, [])
})

test('text-tier: only a colour that is the secondary one counts, and nothing is checked without it', async () => {
  const other = await read('<p style="color:rgba(255,255,255,0.6)">' + SENTENCE + '</p><p style="color:rgba(255,255,255,0.7)">' + SENTENCE + '</p>')
  assert.deepEqual(other, [])
  const without = await read('<p class="quiet">' + SENTENCE + '</p>', '')
  assert.deepEqual(without, [])
})
