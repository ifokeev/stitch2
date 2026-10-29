import type { Page, Request } from '@playwright/test'

/**
 * Opens a screen and waits until it is as it will stay: loaded, the data it fetches in, its fonts drawn, the size of its videos known and the layout still.
 *
 * "networkidle" is not that. A preview video streams for as long as it likes, and a screen with four of them was never idle for 15 seconds, on each of the
 * five loads that a check makes of it (the other screens settle in a fifth of a second). Media is waited for until its size is known (loadedmetadata), which
 * is all that layout needs of it; the rest of the traffic (scripts, styles, images, fonts, the files that a screen fetches) must be quiet for 300ms.
 */
export async function openScreen(page: Page, url: string, timeout = 30_000): Promise<void> {
  const pending = new Set<Request>()
  const start = (request: Request) => {
    if (request.resourceType() !== 'media') pending.add(request)
  }
  const end = (request: Request) => {
    pending.delete(request)
  }
  page.on('request', start)
  page.on('requestfinished', end)
  page.on('requestfailed', end)
  try {
    await page.goto(url, { waitUntil: 'load', timeout }).catch(() => {})
    const began = Date.now()
    let quiet = began
    while (Date.now() - began < 10_000) {
      if (pending.size) quiet = Date.now()
      else if (Date.now() - quiet >= 300) break
      await page.waitForTimeout(40)
    }
  } finally {
    page.off('request', start)
    page.off('requestfinished', end)
    page.off('requestfailed', end)
  }
  await page
    .evaluate(async () => {
      await document.fonts.ready
      const sized = [...document.querySelectorAll('video')].filter((v) => v.preload !== 'none' && (v.currentSrc || v.getAttribute('src')) && v.readyState < 1)
      await Promise.all(
        sized.map(
          (v) =>
            new Promise<void>((done) => {
              v.addEventListener('loadedmetadata', () => done(), { once: true })
              v.addEventListener('error', () => done(), { once: true })
              setTimeout(done, 2000)
            }),
        ),
      )
      await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
    })
    .catch(() => {})
  // Tailwind's browser build and the components settle after load.
  await page.waitForTimeout(200)
}
