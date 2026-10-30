import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { forcedFocus, standards } from '../src/standards.ts'
import { typeIssues, type TextItem } from '../src/typecheck.ts'

// Checks that come from published standards (WCAG 2.2, ARIA authoring practices, MDN) and from the rules of DESIGN.md that a page breaks by drawing.
const base = 'html{background:#111}*{box-sizing:border-box}body{margin:0;font:16px/24px sans-serif;background:#111;color:#eee}button,input,textarea,select{font:inherit;color:inherit}'
const found = async (html: string, type: string, options: { full?: boolean; width?: number; css?: string; raw?: boolean } = {}) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: options.width ?? 900, height: 700 } })
    await page.setContent(options.raw ? html : '<style>' + base + (options.css ?? '') + '</style>' + html)
    await page.evaluate(() => document.fonts.ready)
    return (await page.evaluate(standards, { full: options.full ?? false })).filter((i) => i.type === type)
  } finally { await browser.close() }
}

test('link-as-button: a button in a bar or a footer that is not a menu, a toggle or a form is a link painted as a button', async () => {
  assert.equal((await found('<footer><button>Pricing</button><button aria-expanded="false">Product</button><a href="/docs">Docs</a></footer>', 'link-as-button')).length, 1)
  assert.equal((await found('<nav><button data-open-menu>Menu</button><button aria-haspopup="dialog">Language</button></nav><main><button>Save</button></main>', 'link-as-button')).length, 0, 'a menu, a popup and a button in the page are buttons')
})

test('heading-order and h1-count: levels follow each other, and the page has one h1', async () => {
  assert.equal((await found('<h1>A</h1><h3>B</h3>', 'heading-order')).length, 1)
  assert.equal((await found('<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2>', 'heading-order')).length, 0, 'going up again is fine')
  assert.equal((await found('<h2>A</h2><h2>B</h2>', 'h1-count')).length, 1, 'no h1')
  assert.equal((await found('<h1>A</h1><h1>B</h1>', 'h1-count')).length, 1, 'two h1')
  assert.equal((await found('<h1>A</h1><h2>B</h2>', 'h1-count')).length, 0)
})

test('img-alt and img-broken: a picture says what it shows, and loads', async () => {
  assert.equal((await found('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="40" height="40"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" width="40" height="40"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="A boat" width="40" height="40">', 'img-alt')).length, 1)
  assert.equal((await found('<img src="/nowhere-at-all.png" alt="" width="40" height="40">', 'img-broken')).length, 1)
})

test('autocomplete: a field about the person says what it asks for', async () => {
  assert.equal((await found('<input type="email" aria-label="Email"><input type="password" aria-label="Password" autocomplete="current-password"><input type="text" aria-label="Search the library">', 'autocomplete')).length, 1)
  assert.equal((await found('<input name="postal_code" aria-label="ZIP"><input name="postal_code2" aria-label="ZIP" autocomplete="postal-code">', 'autocomplete')).length, 1)
})

test('dialog-name: a dialog has a name and something to press', async () => {
  assert.equal((await found('<dialog open><button>OK</button></dialog>', 'dialog-name')).length, 1, 'no name')
  assert.equal((await found('<dialog open aria-labelledby="t"><h2 id="t">Delete</h2><button>OK</button></dialog>', 'dialog-name')).length, 0)
  assert.equal((await found('<dialog open aria-label="Info"><p>Nothing here</p></dialog>', 'dialog-name')).length, 1, 'nothing to press')
})

test('placeholder-fit: a placeholder that does not fit is reported', async () => {
  const css = 'input,textarea{display:block;width:220px;padding:0 12px;height:44px;border:1px solid #666;margin:8px}textarea{padding:12px;height:44px}'
  assert.equal((await found('<input placeholder="Say what to change in your video, in your own words">', 'placeholder-fit', { css })).length, 1)
  assert.equal((await found('<input placeholder="Search">', 'placeholder-fit', { css })).length, 0)
  assert.equal((await found('<textarea placeholder="Say what to change in your video, in your own words, and what to keep as it is"></textarea>', 'placeholder-fit', { css })).length, 1, 'a textarea cuts its second line')
})

test('label-centered and choice-alignment: the label in the middle of its control, the words of a choice level with its box', async () => {
  const css = 'button{display:block;height:48px;margin:8px;padding:0 16px;border:1px solid #666;background:#222}'
  assert.equal((await found('<button style="padding-top:14px;padding-bottom:0">Save</button><button>Save</button>', 'label-centered', { css })).length, 1)
  assert.equal((await found('<div style="display:flex;gap:8px"><input type="radio" id="r" style="margin:0;width:18px;height:18px;align-self:flex-start"><label for="r" style="padding-top:12px">Ban</label></div>', 'choice-alignment')).length, 1)
  assert.equal((await found('<div style="display:flex;gap:8px;align-items:center"><input type="radio" id="r" style="margin:0;width:18px;height:18px"><label for="r">Ban</label></div>', 'choice-alignment')).length, 0)
})

test('select-two-arrows, icon-off-centre and row-heights', async () => {
  assert.equal((await found('<div style="position:relative;width:200px"><select style="width:200px;height:44px;appearance:auto"><option>A</option></select><svg width="16" height="16" style="position:absolute;right:12px;top:14px"></svg></div>', 'select-two-arrows')).length, 1)
  assert.equal((await found('<div style="position:relative;width:200px;height:44px"><svg width="16" height="16" style="position:absolute;left:12px;top:50%"></svg></div>', 'icon-off-centre')).length, 1)
  assert.equal((await found('<div style="position:relative;width:200px;height:44px"><svg width="16" height="16" style="position:absolute;left:12px;top:50%;translate:0 -50%"></svg></div>', 'icon-off-centre')).length, 0)
  const card = (h: number) => '<div style="width:200px;height:' + h + 'px;border:1px solid #666;border-radius:12px"></div>'
  assert.equal((await found('<div style="display:flex;gap:8px;align-items:flex-start">' + card(100) + card(140) + '</div>', 'row-heights')).length, 1)
  assert.equal((await found('<div style="display:flex;gap:8px;align-items:flex-start">' + card(100) + card(100) + '</div>', 'row-heights')).length, 0)
})

test('focus-order: a row reversed or moved by order that holds controls, and tabindex above 0', async () => {
  assert.equal((await found('<div style="display:flex;flex-direction:row-reverse"><button>One</button><button>Two</button></div>', 'focus-order')).length, 1)
  assert.equal((await found('<div style="display:flex"><button style="order:2">One</button><button>Two</button></div>', 'focus-order')).length, 1)
  assert.equal((await found('<button tabindex="3">One</button>', 'focus-order')).length, 1)
  assert.equal((await found('<div style="display:flex;flex-direction:row-reverse"><span>One</span><span>Two</span></div><div style="display:flex"><button>One</button><button>Two</button></div>', 'focus-order')).length, 0, 'moving text is not moving controls')
})

test('word-space: a face with a word space under 0.24em is reported', async () => {
  // A system face has a normal space; the check measures it, so only a face with a narrow one is reported, and none is in a plain browser.
  assert.equal((await found('<p>Words in a plain face</p>', 'word-space')).length, 0)
})

test('concentric-corner: a surface inside a rounded surface takes the outer radius less the space between them', async () => {
  const css = '.o{width:300px;height:100px;margin:20px;padding:8px;border-radius:16px;background:#333}.i{width:100%;height:100%;background:#555}'
  assert.equal((await found('<div class="o"><div class="i" style="border-radius:16px"></div></div>', 'concentric-corner', { css })).length, 1, '16px inside 16px with 8px between')
  assert.equal((await found('<div class="o"><div class="i" style="border-radius:8px"></div></div>', 'concentric-corner', { css })).length, 0, '8px is 16 less 8')
  assert.equal((await found('<div class="o" style="padding:0"><div class="i" style="border-radius:16px"></div></div>', 'concentric-corner', { css })).length, 0, 'flush: nothing between them')
})

test('focus-contrast: the ring is 3:1 against what it touches', async () => {
  const css = 'button{display:block;height:44px;margin:12px;padding:0 16px;border:0;border-radius:8px;background:#333}'
  assert.equal((await found('<button class="a">Faint</button>', 'focus-contrast', { full: true, css: css + '.a:focus-visible{outline:2px solid #2a2a2a;outline-offset:2px}' })).length, 1, 'a ring that is almost the page')
  assert.equal((await found('<button class="a">Clear</button>', 'focus-contrast', { full: true, css: css + '.a:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}' })).length, 0)
})

test('focus-forced-colors: with forced colours emulated, focus is an outline, a border or an underline, not a shadow or a colour', async () => {
  const css = 'button{display:block;height:44px;margin:12px;padding:0 16px;border:0;border-radius:8px;background:#333}'
  const forced = async (extra: string) => {
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
      await page.emulateMedia({ forcedColors: 'active' })
      await page.setContent('<style>' + base + css + extra + '</style><button class="a">Control</button>')
      return (await page.evaluate(forcedFocus)).length
    } finally { await browser.close() }
  }
  assert.equal(await forced('.a:focus-visible{box-shadow:0 0 0 2px #a78bfa;outline:none}'), 1, 'a shadow vanishes in forced colours')
  assert.equal(await forced('.a:focus-visible{background:#555;outline:none}'), 1, 'a colour is replaced by the system colour')
  assert.equal(await forced('.a:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}'), 0)
  assert.equal(await forced('.a:focus-visible{box-shadow:0 0 0 2px #a78bfa;outline:none}@media (forced-colors: active){.a:focus-visible{outline:2px solid Highlight}}'), 0, 'a shadow with an outline for forced colours')
})

test('field-edge: the edge or the fill of a field is 3:1 against what is behind it', async () => {
  const css = 'input{display:block;margin:12px;width:240px;height:44px;border-radius:8px;padding:0 12px;background:transparent}'
  assert.equal((await found('<input aria-label="A" style="border:1px solid #1d1d1d">', 'field-edge', { css })).length, 1, 'a hairline that is almost the page')
  assert.equal((await found('<input aria-label="A" style="border:1px solid #8a8a8a">', 'field-edge', { css })).length, 0)
  assert.equal((await found('<input aria-label="A" style="border:0;background:#666">', 'field-edge', { css })).length, 0, 'a fill that shows')
})

test('text-spacing: text that is cut when line height, letters and words are spaced as WCAG 1.4.12 asks is reported', async () => {
  const css = '.b{width:90px;height:26px;overflow:hidden;line-height:24px;font-size:16px;white-space:normal;margin:8px;border:1px solid #666}'
  assert.equal((await found('<div class="b">Two words</div>', 'text-spacing', { full: true, css })).length, 1, 'one line fits, two do not')
  assert.equal((await found('<div class="b" style="height:auto">Two words</div>', 'text-spacing', { full: true, css })).length, 0, 'a box that grows loses nothing')
  assert.equal((await found('<div class="b" style="text-overflow:ellipsis;white-space:nowrap">Two words that run long</div>', 'text-spacing', { full: true, css })).length, 0, 'an ellipsis is chosen')
  assert.equal((await found('<div class="b" style="height:auto">Two words</div>', 'text-spacing', { full: true, css })).length, 0)
})


test('page-lang, page-title, landmark-main and zoom-blocked: what a page says about itself', async () => {
  const doc = (head: string, body: string, lang = ' lang="en"') => '<!doctype html><html' + lang + '><head>' + head + '</head><body>' + body + '</body></html>'
  const many = Array.from({ length: 30 }, (_, i) => '<p>Line ' + i + '</p>').join('')
  assert.equal((await found(doc('<title>A</title>', '<main>' + many + '</main>', ''), 'page-lang', { raw: true })).length, 1)
  assert.equal((await found(doc('', '<main>' + many + '</main>'), 'page-title', { raw: true })).length, 1)
  assert.equal((await found(doc('<title>A</title>', many), 'landmark-main', { raw: true })).length, 1)
  assert.equal((await found(doc('<title>A</title>', '<main>' + many + '</main>'), 'landmark-main', { raw: true })).length, 0)
  assert.equal((await found(doc('<title>A</title><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">', '<main>' + many + '</main>'), 'zoom-blocked', { raw: true })).length, 1)
  assert.equal((await found(doc('<title>A</title><meta name="viewport" content="width=device-width, initial-scale=1">', '<main>' + many + '</main>'), 'zoom-blocked', { raw: true })).length, 0)
})

test('field-name: a field has a label, an aria-label or aria-labelledby, and a placeholder is not one', async () => {
  assert.equal((await found('<input placeholder="Search"><input aria-label="Search"><label>Name <input></label><label for="x">Email</label><input id="x">', 'field-name')).length, 1)
})

test('spacing-grid: a value that is not on the four-pixel grid is reported once, and a centred margin is not spacing', async () => {
  const css = '.a{padding:10px}.b{padding:10px;margin-top:6px}.c{width:300px;margin:0 auto}'
  const list = await found('<div class="a">A</div><div class="b">B</div><div class="c">C</div>', 'spacing-grid', { css })
  assert.deepEqual(list.map((i) => i.message.split(' ')[0]).sort(), ['10px', '6px'], 'ten once, six once, and the auto margins not at all')
})

test('link-as-button leaves pagination alone: it changes a list in place', async () => {
  assert.equal((await found('<nav aria-label="Pages"><button>← Previous</button><button>1</button><button>2</button><button>Next →</button></nav><footer><button>Terms</button></footer>', 'link-as-button')).length, 1)
})

test('label-centered leaves a picture with a badge in its corner alone', async () => {
  const css = 'button{position:relative;display:block;width:72px;height:72px;padding:0;border:1px solid #666;background:#222}button span{position:absolute;right:4px;bottom:4px}'
  assert.equal((await found('<button><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="70" height="70" alt=""><span>0:05</span></button><button><span>0:05</span></button>', 'label-centered', { css })).length, 0)
})

const item = (over: Partial<TextItem>): TextItem => ({ selector: 'p', text: 'Words', family: 'Inter', mono: false, size: 15, weight: 400, lineHeight: 26, tracking: 0.18, color: '#fff', upper: false, numeric: false, lines: 1, ...over })
const level = { name: 'body', mono: false, size: 15, weight: 400, lineHeight: 26, tracking: 0.18, family: 'Inter' }

test('type-family and type-fraction: text in the family DESIGN.md names, on whole pixels', () => {
  const kinds = (items: TextItem[]) => typeIssues([level], items).map((i) => i.type).filter((t) => t === 'type-family' || t === 'type-fraction')
  assert.deepEqual(kinds([item({})]), [])
  assert.deepEqual(kinds([item({ family: 'system-ui' })]), ['type-family'], 'a control that fell back to the browser')
  assert.deepEqual(kinds([item({ family: 'system-ui' }), item({ family: 'system-ui', selector: 'b' })]), ['type-family'], 'once for a family')
  assert.deepEqual(kinds([item({ lineHeight: 19.5 })]), ['type-fraction'])
  assert.deepEqual(kinds([item({ size: 13.33 })]), ['type-fraction'])
  assert.deepEqual(kinds([item({ family: 'Material Symbols' })]), [], 'an icon face is not text')
})
