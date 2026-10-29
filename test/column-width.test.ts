import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { audit } from '../src/audit.ts'

const run = async (width: number, html: string, columns?: number[]) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.setContent('<style>body{margin:0;font:14px sans-serif;background:#111;color:#eee}main{display:block;padding:0 24px}.col{margin:0 auto;height:300px;background:#1a1a1a}</style><main>' + html + '</main>')
    return (await page.evaluate(audit, { comfortable: 44, columns })).filter((i) => i.type === 'column-width')
  } finally { await browser.close() }
}

test('column-width: a constrained column that is not one of the named widths is reported, a named one, a reading measure and full width are not', async () => {
  const columns = [896, 1152]
  const off = await run(1440, '<div class="col" style="max-width:1184px">Billing</div>', columns)
  assert.equal(off.length, 1, JSON.stringify(off.map((i) => i.message)))
  assert.match(off[0]!.message, /1184px, where DESIGN\.md names 896px, 1152px/)
  assert.equal((await run(1440, '<div class="col" style="max-width:1152px">Wide</div>', columns)).length, 0)
  assert.equal((await run(1440, '<div class="col" style="max-width:896px">Narrow</div>', columns)).length, 0)
  assert.equal((await run(1440, '<div class="col" style="max-width:680px">Legal</div>', columns)).length, 0, 'a reading measure is set by the line, not by a step')
  assert.equal((await run(1440, '<div class="col">Full width</div>', columns)).length, 0, 'no max-width, no column')
})

test('column-width: a column inside a reported one is not reported again, a window narrower than the column has none, and no named columns means no check', async () => {
  const columns = [896, 1152]
  const nested = await run(1440, '<div class="col" style="max-width:1184px"><div class="col" style="max-width:1000px">inner</div></div>', columns)
  assert.equal(nested.length, 1)
  assert.equal((await run(1000, '<div class="col" style="max-width:1184px">Billing</div>', columns)).length, 0, 'the container is not held by its max-width here')
  assert.equal((await run(1440, '<div class="col" style="max-width:1184px">Billing</div>')).length, 0)
})
