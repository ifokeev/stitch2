import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { catalogStates } from '../src/states.ts'

test('focusable reading regions require focus feedback, not hover or pressed feedback', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent('<style>pre{width:220px;height:80px;overflow:auto}#good:focus-visible{outline:2px solid blue}#bad{outline:none}button{cursor:pointer}</style>' +
      '<div data-s2="diagnostic"><pre id="good" class="good" tabindex="0">Scrollable trace</pre><pre id="bad" class="bad" tabindex="0">Unmarked trace</pre></div><button data-s2="button">Unresponsive action</button>')
    const { issues } = await catalogStates(page, 'screens/components/library.html', { crop: false })
    assert.ok(!issues.some((i) => i.type === 'state-feedback' && /trace/.test(i.text || '')))
    assert.ok(issues.some((i) => i.type === 'state-focus' && i.text === 'Unmarked trace'))
    assert.ok(!issues.some((i) => i.type === 'state-focus' && i.text === 'Scrollable trace'))
    assert.ok(issues.some((i) => i.type === 'state-feedback' && i.text === 'Unresponsive action'))
  } finally { await browser.close() }
})

test('a pressed layer drawn as a gradient counts as feedback, and a press that adds nothing is still reported', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent('<style>button{cursor:pointer;border:0;background-color:#222;color:#eee}' +
      '.layer:hover,.flat:hover{background-color:#333}' +
      '.layer:active{background-image:linear-gradient(rgba(255,255,255,.1),rgba(255,255,255,.1))}</style>' +
      '<div data-s2="actions"><button class="layer">Layered</button><button class="flat">Flat</button></div>')
    const { issues } = await catalogStates(page, 'screens/components/library.html', { crop: false })
    assert.ok(!issues.some((i) => i.type === 'state-pressed' && i.text === 'Layered'), 'the layer is the press')
    assert.ok(issues.some((i) => i.type === 'state-pressed' && i.text === 'Flat'), 'no layer, no press')
  } finally { await browser.close() }
})

test('a hover rule outside @media (hover: hover) is reported, and one inside it is not', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent('<style>button{cursor:pointer;border:0;background-color:#222;color:#eee}' +
      '@media (hover: hover){.guarded:hover{background-color:#444}}' +
      '.bare:hover{background-color:#444}</style>' +
      '<div data-s2="actions"><button class="guarded">Guarded</button><button class="bare">Bare</button></div>')
    const { issues } = await catalogStates(page, 'screens/components/library.html', { crop: false })
    assert.ok(issues.some((i) => i.type === 'state-hover-touch' && i.text === 'Bare'))
    assert.ok(!issues.some((i) => i.type === 'state-hover-touch' && i.text === 'Guarded'))
    assert.ok(!issues.some((i) => i.type === 'state-hover' && i.text === 'Guarded'), 'a desktop pointer still sees the hover')
    assert.equal(await page.evaluate(() => matchMedia('(hover: hover)').matches), true, 'the page is left as a desktop one')
  } finally { await browser.close() }
})
