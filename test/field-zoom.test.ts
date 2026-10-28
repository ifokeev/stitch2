import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { audit } from '../src/audit.ts'

const zoom = async (width: number, html: string) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width, height: 700 } })
    await page.setContent('<style>body{margin:16px;font:14px sans-serif}input,select,textarea{box-sizing:border-box;height:44px;width:240px;margin:4px;display:block}.big{font-size:16px}.small{font-size:14px}</style>' + html)
    return (await page.evaluate(audit, { comfortable: 44 })).filter((i) => i.type === 'field-zoom')
  } finally { await browser.close() }
}

test('field-zoom: a field under 16px in a phone-sized window is reported, 16px and a disabled or desktop field are not', async () => {
  const fields = '<input class="small" aria-label="Name"><select class="small" aria-label="Size"><option>1</option></select><textarea class="small" aria-label="Note"></textarea><input class="big" aria-label="Email"><input class="small" disabled aria-label="Locked"><input type="checkbox" aria-label="Agree">'
  const phone = await zoom(390, fields)
  assert.equal(phone.length, 3, JSON.stringify(phone.map((i) => i.message)))
  assert.match(phone[0]!.message, /14px in a field/)
  assert.equal((await zoom(1280, fields)).length, 0, 'a window with a pointer is not where iOS zooms')
})
