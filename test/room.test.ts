import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { audit } from '../src/audit.ts'

// Room around controls: a focus ring that a container cuts, two rings at once, and a control whose box touches the edge of what it sits on.
const issues = async (html: string, type: string, width = 900) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width, height: 700 } })
    await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font:14px sans-serif;background:#111;color:#eee}button,a,input{font:inherit;color:inherit}' +
      'button,a.b{display:inline-flex;align-items:center;justify-content:center;height:44px;min-width:44px;padding:0 12px;border:0;border-radius:8px;background:transparent}' +
      '.ring:focus-visible,.row:focus-within{outline:2px solid #a78bfa;outline-offset:2px}.panel{width:300px;margin:20px;border:1px solid #444;border-radius:12px;background:#222}.clip{overflow:hidden}</style>' + html)
    return (await page.evaluate(audit, { comfortable: 44 })).filter((i) => i.type === type)
  } finally { await browser.close() }
}

test('ring-clipped: a control at the edge of a container that clips is reported, and room inside it (or a ring drawn inside) is not', async () => {
  const cut = await issues('<div class="panel clip"><button class="ring">Save</button></div>', 'ring-clipped')
  assert.equal(cut.length, 1, JSON.stringify(cut))
  assert.match(cut[0]!.message, /cut off at the left and (top and )?bottom|cut off at the (left|top)/)
  assert.equal((await issues('<div class="panel clip" style="padding:4px"><button class="ring">Save</button></div>', 'ring-clipped')).length, 0, '4px of padding is room for a 2px ring at 2px')
  assert.equal((await issues('<div class="panel clip"><button class="ring" style="outline-offset:-2px">Save</button></div>', 'ring-clipped')).length, 0, 'a ring drawn inside is not cut')
  assert.equal((await issues('<div class="panel"><button class="ring">Save</button></div>', 'ring-clipped')).length, 0, 'a container that does not clip cuts nothing')
})

test('ring-clipped: a control scrolled partly out of a list is cut by the scrolling, not by a missing margin', async () => {
  const found = await issues('<div style="height:60px;overflow:auto;width:300px;margin:20px"><div style="height:50px"></div><button class="ring" style="margin:4px">Below the fold</button></div>', 'ring-clipped')
  assert.equal(found.length, 0)
})

test('ring-double: a control and the row around it that both draw a ring are reported; one ring is not', async () => {
  const two = await issues('<label class="row" style="display:flex;gap:8px;padding:8px;margin:20px"><input type="checkbox" class="ring" style="width:18px;height:18px">Audio</label>', 'ring-double')
  assert.equal(two.length, 1, JSON.stringify(two))
  assert.equal((await issues('<label class="row" style="display:flex;gap:8px;padding:8px;margin:20px"><input type="checkbox" style="width:18px;height:18px;outline:none">Audio</label>', 'ring-double')).length, 0, 'the row draws it, the box does not')
})

test('edge-flush: a control whose box is less than 4px from a surface it sits on is reported', async () => {
  const flush = await issues('<div class="panel" style="padding:1px 12px"><button>Save</button></div>', 'edge-flush')
  assert.equal(flush.length, 1, JSON.stringify(flush))
  assert.match(flush[0]!.message, /edge less than 4px from/)
  assert.equal((await issues('<div class="panel" style="padding:4px 12px"><button>Save</button></div>', 'edge-flush')).length, 0, '4px is room')
})

test('edge-flush: a bar under a navigation, with controls touching the navigation, is reported; with 4px between, it is not', async () => {
  const nav = '<nav style="height:60px;background:#000;border-bottom:1px solid #333"></nav>'
  assert.equal((await issues(nav + '<div style="display:flex;min-height:44px;padding:0 24px"><button>Get code</button></div>', 'edge-flush')).length, 1)
  assert.equal((await issues(nav + '<div style="display:flex;min-height:44px;padding:4px 24px"><button>Get code</button></div>', 'edge-flush')).length, 0)
})

test('edge-flush: a control that fills its surface on three sides is its content, and a shape that paints inside its own box is measured elsewhere', async () => {
  assert.equal((await issues('<div class="panel" style="height:100px"><button style="width:100%;height:100px;border-radius:12px">Open</button></div>', 'edge-flush')).length, 0, 'a picture that opens')
  assert.equal((await issues('<div class="panel" style="padding:0"><button style="width:44px;height:44px;padding:4px;border-radius:9999px;background-clip:content-box;background-color:#444"></button></div>', 'edge-flush')).length, 0, 'a round icon that paints inside its box')
  assert.equal((await issues('<div class="panel" style="padding:0"><a class="b" href="#" style="border-radius:0;width:100%">A row</a></div>', 'edge-flush')).length, 0, 'a square row spans its card on purpose')
})

test('edge-flush: a link that is only its words has no box to fill, and the side of a surface that is not drawn is not an edge', async () => {
  assert.equal((await issues('<div class="panel" style="padding:0 0 0 0"><a class="b" href="#" style="padding:0;border-radius:6px;justify-content:flex-start;margin:8px 0">Show all</a></div>', 'edge-flush')).length, 0, 'words flush with the column, 8px above and below')
  assert.equal((await issues('<div style="border-top:1px solid #444;margin:20px;width:300px"><a class="b" href="#" style="margin-top:16px;padding:0 12px;background:#222">Open</a></div>', 'edge-flush')).length, 0, 'only the top is drawn: the left and the bottom are the page')
  assert.equal((await issues('<div style="border-top:1px solid #444;margin:20px;width:300px"><a class="b" href="#" style="margin-top:1px;padding:0 12px;background:#222">Open</a></div>', 'edge-flush')).length, 1, 'the drawn top is an edge')
})

test('ring-clipped: a scroller cuts a ring only where its content ends, and a tile that happens to sit at the edge of a row that goes on is not cut', async () => {
  const row = (scroll: number, pad: number) => '<div id="row" style="display:flex;gap:8px;overflow-x:auto;width:300px;padding:4px ' + pad + 'px;margin:20px" data-scroll="' + scroll + '">' + Array.from({ length: 6 }, (_, i) => '<button class="ring" style="flex:none;width:96px">' + (i + 1) + '</button>').join('') + '</div><script>document.getElementById("row").scrollLeft=' + scroll + '</script>'
  assert.equal((await issues(row(0, 0), 'ring-clipped')).length, 1, 'the first tile at the start of the content, with no padding, is cut')
  assert.equal((await issues(row(0, 4), 'ring-clipped')).length, 0, 'with 4px of padding it is not')
  assert.equal((await issues(row(4, 4), 'ring-clipped')).length, 1, 'a row that snapped to its first tile and hid the padding cuts it')
  assert.equal((await issues(row(110, 4), 'ring-clipped')).length, 0, 'a tile at the edge of a row that goes on both ways is scrolled, not cut')
})
