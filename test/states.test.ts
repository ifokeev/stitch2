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
