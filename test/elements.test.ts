import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium, type Browser } from '@playwright/test'

let browser: Browser
let script: string
before(async () => {
  browser = await chromium.launch()
  const entry = fileURLToPath(new URL('../src/elements.ts', import.meta.url))
  const result = await build({ stdin: { resolveDir: fileURLToPath(new URL('..', import.meta.url)), contents: `import {defineElements} from ${JSON.stringify(entry)};defineElements({child:({children=''})=>'<div>'+children+'</div>',shell:async({children=''})=>'<section>'+children+'</section>'},{prefix:'ce',render:(component,props)=>component(props)});` }, bundle: true, format: 'iife', platform: 'browser', write: false })
  script = result.outputFiles[0]!.text
})
after(async () => { await browser?.close() })

test('nested component replacement preserves its own IDs and external labels, descriptions and fragment targets', async () => {
  const page = await browser.newPage()
  try {
    await page.setContent('<label for="name">Name</label><button aria-controls="anchor">Show section</button><a href="#anchor">Jump</a><ce-shell><ce-child><input id="name" aria-describedby="hint"><span id="hint">Help</span></ce-child><h2 id="anchor">Section</h2></ce-shell>')
    await page.addScriptTag({ content: script })
    await page.waitForFunction(() => !document.querySelector('ce-shell,ce-child'))
    assert.deepEqual(await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id).sort()), ['anchor', 'hint', 'name'])
    await page.locator('label').click()
    assert.equal(await page.locator('#name').evaluate(node => node === document.activeElement), true)
    assert.equal(await page.locator('#name').getAttribute('aria-describedby'), 'hint')
    assert.equal(await page.locator('button').getAttribute('aria-controls'), 'anchor')
    assert.equal(await page.locator('a').getAttribute('href'), '#anchor')
  } finally { await page.close() }
})

test('true collisions outside the replaced component still get unique IDs and local references', async () => {
  const page = await browser.newPage()
  try {
    // One external collision is before the host, the other after: getElementById alone cannot find both.
    await page.setContent('<span id="name">Outside first</span><ce-shell><label for="name">Name</label><input id="name" aria-describedby="hint"><span id="hint">Inside help</span></ce-shell><span id="hint">Outside last</span>')
    await page.addScriptTag({ content: script })
    await page.waitForFunction(() => !document.querySelector('ce-shell'))
    const input = page.locator('input')
    const renamed = await input.getAttribute('id')
    assert.match(renamed!, /^name-s2-/)
    assert.equal(await page.locator('label').getAttribute('for'), renamed)
    const description = await input.getAttribute('aria-describedby')
    assert.match(description!, /^hint-s2-/)
    assert.equal(await page.locator(`#${description}`).textContent(), 'Inside help')
    assert.equal(await page.locator('#hint').textContent(), 'Outside last')
    const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id))
    assert.equal(ids.length, new Set(ids).size)
  } finally { await page.close() }
})
