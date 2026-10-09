/**
 * The stitch2 server: the canvas at /, DESIGN.md drawn at /design, the screen list at /api/screens
 * (POST /api/screens/meta sets a version's status or note), check results at /api/checks, live-reload events
 * at /events, and every file under design/ by its path. Local only (127.0.0.1).
 * Usage: stitch2 canvas   (PORT=4400 by default)
 */
import { existsSync, readFileSync, statSync, watch } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONFIG_FILE, config } from './config.ts'
import { designPage } from './design-page.ts'
import { annotate } from './pick.ts'

/**
 * Inlines <link rel="stylesheet" type="text/tailwindcss" href="…">: the Tailwind v4 browser build reads @theme and
 * @utility only from inline <style type="text/tailwindcss"> blocks. On one line, so source line numbers hold.
 */
function inlineTailwind(html: string, file: string): string {
  return html.replace(/<link\b[^>]*\btype="text\/tailwindcss"[^>]*>/g, (tag) => {
    const href = /\bhref="([^"]+)"/.exec(tag)?.[1]
    const css = href && (href.startsWith('/') ? join(ROOT, href) : join(dirname(file), href))
    if (!css || !existsSync(css)) return `<!-- stitch2: ${href} not found -->`
    return `<style type="text/tailwindcss">${readFileSync(css, 'utf8').replace(/\s*\n\s*/g, ' ')}</style>`
  })
}
import { listScreens, ROOT, STATUSES, type Status, tag, writeMeta } from './screens.ts'

const CANVAS = fileURLToPath(new URL('./canvas.html', import.meta.url))
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
}

export function startServer(port: number): Promise<{ port: number; close: () => void }> {
  const clients = new Set<ServerResponse>()
  const changed = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  // Editors write files in bursts; one event per quiet moment is enough.
  const watcher = watch(ROOT, { recursive: true }, (_event, file) => {
    if (!file || file.startsWith('renders')) return
    changed.add(file.toString())
    clearTimeout(timer)
    timer = setTimeout(() => {
      const data = `data: ${JSON.stringify({ paths: [...changed] })}\n\n`
      changed.clear()
      for (const c of clients) c.write(data)
    }, 150)
  })
  const keepAlive = setInterval(() => {
    for (const c of clients) c.write(': ping\n\n')
  }, 25_000)

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://lab')
    const json = (v: unknown) => {
      res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' })
      res.end(JSON.stringify(v))
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' })
      return res.end(readFileSync(CANVAS))
    }
    if (url.pathname === '/design') {
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' })
      return res.end(designPage())
    }
    if (url.pathname === '/compare/index.html' && !existsSync(join(ROOT, 'compare/index.html'))) {
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' })
      return res.end(
        '<body style="background:#0f0f11;color:#a1a1aa;font:15px system-ui;padding:32px">No comparison yet: run <code>stitch2 compare</code> with the app running.</body>',
      )
    }
    if (url.pathname === '/consistency/index.html' && !existsSync(join(ROOT, 'consistency/index.html'))) {
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' })
      return res.end(
        '<body style="background:#0f0f11;color:#a1a1aa;font:15px system-ui;padding:32px">No consistency report yet: run <code>stitch2 consistency</code>.</body>',
      )
    }
    if (url.pathname === '/api/screens/meta' && req.method === 'POST') {
      let body = ''
      req.on('data', (c) => {
        body += c
      })
      req.on('end', () => {
        try {
          const { path, status, note } = JSON.parse(body) as { path: string; status?: Status; note?: string }
          const all = listScreens()
          const target = all.find((s) => s.path === path)
          if (!target || (status && !STATUSES.includes(status))) throw new Error('unknown screen or status')
          const values: Record<string, string | undefined> = {}
          if (status) values[tag('status')] = status
          if (note !== undefined) values[tag('note')] = note.trim() || undefined
          writeMeta(path, values)
          // One approved version per screen and device: approving archives the previous one.
          if (status === 'approved')
            for (const s of all)
              if (
                s.path !== path &&
                s.screen === target.screen &&
                s.device === target.device &&
                s.status === 'approved'
              )
                writeMeta(s.path, { [tag('status')]: 'archived' })
          json(listScreens())
        } catch (e) {
          res.writeHead(400, { 'content-type': 'text/plain' })
          res.end(String(e))
        }
      })
      return
    }
    if (url.pathname === '/api/config') return json(config)
    if (url.pathname === '/api/screens') return json(listScreens())
    if (url.pathname === '/api/checks') {
      const file = join(ROOT, 'checks.json')
      return json(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { screens: {} })
    }
    if (url.pathname === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      })
      res.write(': connected\n\n')
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }
    const file = normalize(join(ROOT, decodeURIComponent(url.pathname)))
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      return res.end('not found')
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    // The canvas loads screens with ?pick: their elements carry source lines for picking.
    if (extname(file) === '.html') {
      const html = inlineTailwind(readFileSync(file, 'utf8'), file)
      res.end(url.searchParams.has('pick') ? annotate(html) : html)
    } else res.end(readFileSync(file))
  })

  return new Promise((resolve) => {
    // Loopback only, on both IPv4 and IPv6: port forwarders often reach "localhost" as ::1. HOST overrides it
    // (HOST=0.0.0.0 to open the canvas to the network).
    const host = process.env.HOST ?? '127.0.0.1'
    let v6: ReturnType<typeof createServer> | undefined
    server.listen(port, host, () => {
      const address = server.address()
      const actual = typeof address === 'object' && address ? address.port : port
      if (!process.env.HOST) {
        v6 = createServer((req, res) => server.emit('request', req, res))
        v6.on('error', () => {}).listen(actual, '::1')
      }
      resolve({
        port: actual,
        close: () => {
          watcher.close()
          clearInterval(keepAlive)
          for (const c of clients) c.end()
          server.close()
          v6?.close()
        },
      })
    })
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await startServer(Number(process.env.PORT ?? 4400))
  console.log(
    `${config.name}: http://localhost:${port}  (${CONFIG_FILE ?? 'no stitch2.config.json, defaults'}; screens from ${config.screenDirs.join(', ')})`,
  )
}
