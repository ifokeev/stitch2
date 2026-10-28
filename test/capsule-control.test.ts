import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { audit } from '../src/audit.ts'

const capsules = async (html: string) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
    await page.setContent('<style>body{margin:16px;font:14px sans-serif;background:#111;color:#eee}button,a{box-sizing:border-box;border:0;background:transparent;color:inherit;font:inherit}.bar{display:flex;align-items:center;gap:4px;height:52px;padding:4px 12px;border:1px solid #555;border-radius:9999px;background:#222;margin:8px 0;width:max-content}.sq{width:44px;height:44px;border-radius:8px}.round{width:44px;height:44px;border-radius:9999px}.box{display:flex;gap:4px;padding:6px;border:1px solid #555;border-radius:12px;background:#222;margin:8px 0;width:max-content}.link{border-radius:0;padding:0 8px;height:44px;display:inline-flex;align-items:center}.chip{display:inline-flex;align-items:center;height:36px;padding:0 12px;border-radius:9999px;background:#333}.bare{display:flex;align-items:center;height:52px;padding:0 12px;border-radius:9999px;margin:8px 0;width:max-content}</style>' + html)
    return (await page.evaluate(audit, { comfortable: 44 })).filter((i) => i.type === 'capsule-control')
  } finally { await browser.close() }
}

test('capsule-control: a rounded square in a capsule is reported, a circle, a square corner and a rounded box are not', async () => {
  const found = await capsules('<div class="bar"><span>Label</span><a class="sq" href="#" aria-label="Download">D</a><button class="sq" aria-label="Close">X</button></div>')
  assert.equal(found.length, 2, JSON.stringify(found.map((i) => i.message)))
  assert.match(found[0]!.message, /8px in a capsule/)
  assert.equal((await capsules('<div class="bar"><a class="round" href="#" aria-label="Download">D</a><button class="round" aria-label="Close">X</button></div>')).length, 0, 'circles follow the capsule')
  assert.equal((await capsules('<div class="bar"><a class="link" href="#">Docs</a><a class="link" href="#">Help</a></div>')).length, 0, 'a link with a square corner has no box to meet the curve')
  assert.equal((await capsules('<div class="box"><button class="sq" aria-label="Close">X</button></div>')).length, 0, 'a rounded box is not a capsule')
})

test('capsule-control: the capsule must be drawn, a chip is not a capsule that holds controls, and a field with no box is left alone', async () => {
  assert.equal((await capsules('<div class="bare"><button class="sq" aria-label="Close">X</button></div>')).length, 0, 'a capsule with no fill or line is only a row')
  assert.equal((await capsules('<button class="chip">Filter</button>')).length, 0)
  assert.equal((await capsules('<div class="bar"><textarea aria-label="Message" style="border:0;background:transparent;border-radius:8px;height:40px"></textarea></div>')).length, 0, 'a field with no box of its own')
})
