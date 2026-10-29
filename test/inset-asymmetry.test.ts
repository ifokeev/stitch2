import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { audit } from '../src/audit.ts'

const ends = async (html: string) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
    await page.setContent('<style>body{margin:16px;font:14px sans-serif;background:#111;color:#eee}button,a{box-sizing:border-box;border:0;background:transparent;color:inherit;font:inherit}.bar{display:flex;align-items:center;gap:4px;height:46px;border:1px solid #555;border-radius:9999px;background:#222;margin:8px 0;width:max-content}.round{width:44px;height:44px;padding:4px;border-radius:9999px;background-clip:content-box;background-color:#444;display:inline-block}.label{margin-inline-start:12px}.pad{padding-inline:17px 0}.chip{display:inline-flex;align-items:center;gap:6px;height:36px;border:1px solid #555;border-radius:8px;background:#222}</style>' + html)
    return (await page.evaluate(audit, { comfortable: 44 })).filter((i) => i.type === 'inset-asymmetry')
  } finally { await browser.close() }
}

test('inset-asymmetry: a capsule with two circles that stands 17px from the first and 5px from the last is reported', async () => {
  const found = await ends('<div class="bar pad"><a class="round" href="#" aria-label="Download">D</a><button class="round" aria-label="Close">X</button></div>')
  assert.equal(found.length, 1, JSON.stringify(found.map((i) => i.message)))
  assert.match(found[0]!.message, /Space of 21px at the start and 4px at the end, where both ends hold a control/)
  assert.equal((await ends('<div class="bar"><a class="round" href="#" aria-label="Download">D</a><button class="round" aria-label="Close">X</button></div>')).length, 0, 'the same gap at both ends')
})

test('inset-asymmetry: two controls of different sizes that are each as far from the end as from the top and bottom are concentric, and are left alone', async () => {
  const logo = '<span style="display:inline-block;width:24px;height:24px;border-radius:6px;background:#639;margin-inline-start:16px"></span>'
  const dot = '<button class="round" style="width:40px;height:40px;padding:0;margin-inline-end:8px" aria-label="Status">o</button>'
  assert.equal((await ends('<div class="bar" style="height:57px;padding-block:0">' + logo + '<span style="padding:0 12px">Coming soon</span>' + dot + '</div>')).length, 0)
})

test('inset-asymmetry: text at one end and a control at the other may differ, and so may a box that its content does not fill', async () => {
  assert.equal((await ends('<div class="bar"><span class="label">Clip 1</span><button class="round" aria-label="Close">X</button></div>')).length, 0, 'optical: text and a circle')
  assert.equal((await ends('<div class="chip" style="padding:0 12px 0 28px"><span>Filter</span><span>3</span></div>')).length, 1, 'two pieces of text with 28px and 12px')
  assert.equal((await ends('<div class="chip" style="width:300px;padding:0 12px"><span>Filter</span></div>')).length, 0, 'one item, left-aligned in a wide box')
})
