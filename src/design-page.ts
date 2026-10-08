/**
 * The design system page (/design on the stitch2 server), with its own neutral styling: DESIGN.md's tokens drawn as swatches, live type
 * samples, spacing bars, radii and component tokens, followed by its prose. Rendered on each request.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readDesign } from './design-md.ts'
import { ROOT } from './screens.ts'

const esc = (s: unknown) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** Enough Markdown for DESIGN.md's prose: headings, lists, paragraphs, bold, inline code. */
function markdown(md: string): string {
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  const out: string[] = []
  let list = false
  let para: string[] = []
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  let item: string[] | null = null
  const endItem = () => {
    if (item) out.push(`<li>${inline(item.join(' '))}</li>`)
    item = null
  }
  for (const line of md.split('\n')) {
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    const li = /^-\s+(.*)$/.exec(line)
    if (h) {
      flush()
      endItem()
      if (list) out.push('</ul>')
      list = false
      out.push(`<h${h[1]!.length + 1}>${inline(h[2]!)}</h${h[1]!.length + 1}>`)
    } else if (li) {
      flush()
      endItem()
      if (!list) out.push('<ul>')
      list = true
      item = [li[1]!]
    } else if (!line.trim()) {
      flush()
      endItem()
      if (list) out.push('</ul>')
      list = false
    } else if (item) item.push(line.trim())
    else para.push(line.trim())
  }
  flush()
  endItem()
  if (list) out.push('</ul>')
  return out.join('\n')
}

export function designPage(): string {
  const d = readDesign()
  const text = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8')
  const prose = text.replace(/^---\n[\s\S]*?\n---\n/, '')
  const colours = Object.entries(d.colors).filter(
    ([n, v]) => n !== 'primary' || !Object.entries(d.colors).some(([k, w]) => k !== n && w === v),
  )
  // Load the families DESIGN.md names from Google Fonts, so the type samples render in them.
  const families = [
    ...new Set(
      Object.values(d.typography)
        .map((t) => t.fontFamily)
        .filter(Boolean),
    ),
  ] as string[]
  const fonts = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${encodeURIComponent(f).replaceAll('%20', '+')}:wght@400;500;600;700`).join('&')}&display=swap`
  const swatch = ([name, value]: [string, string]) =>
    `<div class="sw"><span style="background:${esc(value)}"></span><b>${esc(name)}</b><code>${esc(value)}</code></div>`
  const type = Object.entries(d.typography)
    .map(
      ([name, t]) =>
        `<div class="ty"><div class="type-${esc(name)}">${/number|stat|timer/.test(name) ? '82.5 · 1:32 · 80.7' : name.endsWith('caps') ? 'Recent workouts' : 'Barbell Bench Press'}</div><code>${esc(name)} · ${esc(t.fontFamily)} ${esc(t.fontSize)}/${esc(t.lineHeight)} ${esc(t.fontWeight)}${t.letterSpacing && t.letterSpacing !== '0em' ? ` ${esc(t.letterSpacing)}` : ''}</code></div>`,
    )
    .join('')
  const spacing = Object.entries(d.spacing)
    .map(
      ([n, v]) =>
        `<div class="sp"><code>${esc(n)}</code><span style="width:${esc(v)}"></span><code>${esc(v)}</code></div>`,
    )
    .join('')
  const radii = Object.entries(d.rounded)
    .map(
      ([n, v]) =>
        `<div class="ra"><span style="border-radius:${esc(v)}"></span><code>${esc(n)} ${esc(v)}</code></div>`,
    )
    .join('')
  const components = Object.entries(d.components)
    .map(
      ([n, props]) =>
        `<tr><td><b>${esc(n)}</b></td><td>${Object.entries(props)
          .map(([k, v]) => `<code>${esc(k)}: ${esc(v)}</code>`)
          .join(' ')}</td></tr>`,
    )
    .join('')
  return `<!doctype html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8" /><title>DESIGN.md — ${esc(d.name)}</title>
<link href="${esc(fonts)}" rel="stylesheet" />
<link rel="stylesheet" href="/tokens.css" />
<style>
  body { margin: 0; background: #0f0f11; color: #f4f4f5; font: 15px/1.55 Geist, system-ui, sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 32px 32px 96px; }
  h1 { font-size: 32px; letter-spacing: -0.03em; margin: 0 0 4px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #a1a1aa; margin: 40px 0 12px; }
  h3, h4 { margin: 24px 0 8px; }
  section.prose h2 { font-size: 20px; text-transform: none; letter-spacing: -0.02em; color: #f4f4f5; }
  code { font: 12px/1.4 "Geist Mono", ui-monospace, monospace; color: #a1a1aa; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .sw { display: grid; gap: 4px; } .sw span { height: 56px; border-radius: 12px; border: 1px solid #2e2e33; }
  .ty { padding: 14px 0; border-bottom: 1px solid #2e2e33; display: grid; gap: 6px; }
  .sp { display: grid; grid-template-columns: 70px auto 1fr; gap: 12px; align-items: center; margin: 6px 0; }
  .sp span { height: 12px; background: #a1a1aa; border-radius: 3px; }
  .ra { display: grid; gap: 6px; justify-items: start; } .ra span { width: 72px; height: 72px; background: #232327; border: 1px solid #2e2e33; }
  table { border-collapse: collapse; width: 100%; } td { border-bottom: 1px solid #2e2e33; padding: 8px 8px 8px 0; vertical-align: top; } td code { margin-right: 10px; display: inline-block; }
  .prose li { margin: 4px 0; } .prose strong { color: #f4f4f5; } .prose { color: #d4d4d8; }
</style></head>
<body><main>
<h1>${esc(d.name)} design system</h1><code>design/DESIGN.md · tokens in the front matter, rules below</code>
<h2>Colours</h2><div class="grid">${colours.map(swatch).join('')}</div>
<h2>Type levels</h2>${type}
<h2>Spacing</h2>${spacing}
<h2>Radii</h2><div class="grid">${radii}</div>
<h2>Components</h2><table>${components}</table>
<section class="prose">${markdown(prose)}</section>
</main></body></html>`
}
