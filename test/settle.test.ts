import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { openScreen } from '../src/settle.ts'

const serve = async () => {
  const hung: import('node:http').ServerResponse[] = []
  const server = createServer((request, response) => {
    if (request.url === '/') {
      response.setHeader('content-type', 'text/html')
      // A video that streams for as long as it likes, and data that arrives after the page has loaded.
      response.end('<div id="out">waiting</div><script>addEventListener("load", () => { setTimeout(() => { const v = document.createElement("video"); v.preload = "auto"; v.muted = true; v.src = "/stream.webm"; document.body.append(v) }, 30); setTimeout(() => fetch("/data.json").then((r) => r.json()).then((d) => { document.getElementById("out").textContent = d.text }), 100) })</script>')
    } else if (request.url === '/stream.webm') {
      response.writeHead(200, { 'content-type': 'video/webm' })
      response.write(Buffer.alloc(16))
      hung.push(response)
    } else if (request.url === '/data.json') {
      setTimeout(() => { response.setHeader('content-type', 'application/json'); response.end('{"text":"loaded"}') }, 250)
    } else response.writeHead(404).end()
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  return { url: 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/', close: () => { for (const r of hung) r.destroy(); server.close() } }
}

test('openScreen: a video that never finishes streaming does not hold the screen, and the data the screen fetches after load does', async () => {
  const app = await serve()
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const began = Date.now()
    await openScreen(page, app.url)
    const took = Date.now() - began
    assert.equal(await page.locator('#out').textContent(), 'loaded', 'the fetched data is in')
    // networkidle would wait for the stream for the whole 30s of its timeout; what is waited for here is the size of the video, for 2s at most.
    assert.ok(took < 6000, 'took ' + took + 'ms: the stream was waited for')
  } finally {
    await browser.close()
    app.close()
  }
})
