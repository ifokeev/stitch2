import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { audit } from '../src/audit.ts'

const radii = async (html: string) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
    await page.setContent('<style>body{margin:16px;font:14px sans-serif}button,input,select{box-sizing:border-box;height:44px;margin:4px;border:1px solid #888;background:#eee}.a{border-radius:8px}.b{border-radius:12px}.pill{border-radius:999px}.track{display:inline-flex;gap:4px;padding:4px;border:1px solid #888;border-radius:16px}.track button{height:36px;border-radius:12px}</style>' + html)
    const issues = await page.evaluate(audit, { comfortable: 44 })
    return issues.filter((i) => i.type === 'radius-mismatch')
  } finally { await browser.close() }
}

test('radius-mismatch: a control with another corner than the rest is reported, a pill, a square corner and an inset segment are not', async () => {
  const found = await radii('<button class="a">One</button><button class="a">Two</button><button class="a">Three</button><input class="b" placeholder="Search"><button class="pill">Pill</button><button style="border-radius:0">Square</button><div class="track"><button class="b">Day</button><button class="b">Week</button></div>')
  assert.equal(found.length, 1, JSON.stringify(found.map((i) => i.message)))
  assert.match(found[0]!.message, /12px, where 3 of the 4 controls here use 8px/)
})

test('radius-mismatch: controls that share one radius say nothing', async () => {
  assert.equal((await radii('<button class="a">One</button><input class="a" placeholder="Search"><select class="a"><option>Two</option></select>')).length, 0)
})
