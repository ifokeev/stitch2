import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { audit } from '../src/audit.ts'

const focusIssues = async (html: string) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
    await page.setContent('<style>body{margin:16px;font:14px sans-serif}input,button{margin:8px;height:44px;display:block}.ring:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}.bare{outline:none}.bare:focus-visible{outline:none}</style>' + html)
    await page.evaluate(() => (document.querySelector('[data-first]') as HTMLElement | null)?.focus())
    return (await page.evaluate(audit, { comfortable: 44 })).filter((i) => i.type === 'focus-visible').map((i) => i.selector)
  } finally { await browser.close() }
}

test('focus-visible: a control that has focus when the check runs is compared from its unfocused look, so it counts the same as one that has not', async () => {
  const ring = '<input class="ring" aria-label="Search" data-first><button class="ring">Go</button>'
  assert.deepEqual(await focusIssues(ring), [], 'a ring on a control that was already focused is a ring')
  const bare = '<input class="bare" aria-label="Search" data-first><button class="bare">Go</button>'
  assert.equal((await focusIssues(bare)).length, 2, 'no ring is no ring, focused or not')
})
