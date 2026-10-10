/**
 * The Languages page (/languages on the canvas server): each screen in a row, once per language, so a label that
 * only breaks in German or a layout that flips wrong in Arabic shows next to the others. ?screen=<path> shows one
 * screen; otherwise every active screen. Starts with the check languages; "All" adds every locale.
 */
import { allLocales, checkLocales, sourceLocale } from './i18n.ts'
import { listScreens } from './screens.ts'

export function languagesPage(only?: string): string {
  const screens = listScreens()
    .filter((s) => (only ? s.path === only : s.kind === 'screen' && s.status !== 'archived'))
    .map((s) => ({ path: s.path, label: s.kind === 'components' ? 'Component catalog' : s.screen + ' ' + s.device + ' ' + s.version, width: s.width }))
  const data = { screens, source: sourceLocale(), check: [sourceLocale(), ...checkLocales()], all: allLocales() }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Languages</title><style>
  body { background: #0f0f11; color: #e4e4e7; font: 13px/1.4 system-ui, sans-serif; margin: 0; }
  header { align-items: center; background: #0f0f11; border-bottom: 1px solid #26262b; display: flex; gap: 12px; padding: 12px 140px 12px 20px; position: sticky; top: 0; z-index: 1; }
  header h1 { font-size: 15px; margin: 0 8px 0 0; }
  header p { color: #71717a; margin: 0 0 0 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .seg { background: #18181b; border: 1px solid #26262b; border-radius: 8px; display: flex; padding: 2px; }
  .seg button { background: none; border: 0; border-radius: 6px; color: #a1a1aa; cursor: pointer; font: inherit; padding: 4px 10px; }
  .seg button.on { background: #27272a; color: #fafafa; }
  section { padding: 16px 20px 8px; }
  section h2 { color: #a1a1aa; font-size: 13px; font-weight: 600; margin: 0 0 10px; }
  section h2 code { color: #71717a; font-weight: 400; margin-left: 8px; }
  .row { align-items: flex-start; display: flex; gap: 24px; overflow-x: auto; padding-bottom: 16px; }
  .frame { flex: none; }
  .frame .label { align-items: center; color: #a1a1aa; display: flex; flex-wrap: wrap; gap: 4px 6px; margin-bottom: 6px; min-width: 0; white-space: nowrap; }
  .frame .label .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .frame .label > :not(.n) { flex: none; }
  .frame .label b { color: #fafafa; }
  .frame .miss { background: #422006; border-radius: 99px; color: #fbbf24; font-size: 11px; padding: 1px 7px; }
  .frame .label button { background: #18181b; border: 1px solid #26262b; border-radius: 6px; color: #a1a1aa; cursor: pointer; font: inherit; font-size: 11px; margin-left: auto; padding: 1px 7px; }
  .frame .box { border-radius: 14px; overflow: hidden; }
  .frame iframe { background: #fff; border: 0; display: block; }
  </style></head><body>
  <header><h1>Languages</h1>
    <div class="seg" id="set"><button type="button" data-v="check" title="The source, the pseudo-languages and the ones check runs">Check languages</button><button type="button" data-v="all">All</button></div>
    <div class="seg" id="zoom"><button type="button" data-v="0.4">40%</button><button type="button" data-v="0.6">60%</button><button type="button" data-v="1">100%</button></div>
    <p>Pseudo: every text about 40% longer, and right to left. Copy a frame to reference it.</p></header>
  <main></main>
  <script>
  const D = ${JSON.stringify(data).replaceAll('<', '\\u003c')}
  const theme = localStorage.getItem('stitch2-theme')
  let set = localStorage.getItem('stitch2-lang-set') ?? 'check'
  let zoom = Number(localStorage.getItem('stitch2-lang-zoom') ?? 0.4)
  const name = (l) => l === 'pseudo' ? 'Pseudo: long text' : l === 'pseudo-rtl' ? 'Pseudo: right to left' : (new Intl.DisplayNames([l], { type: 'language' }).of(l) ?? l) + (l === D.source ? ', source' : '')
  async function copy(text) {
    try { await navigator.clipboard.writeText(text) } catch { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove() }
  }
  function render() {
    for (const b of document.querySelectorAll('#set button')) b.classList.toggle('on', b.dataset.v === set)
    for (const b of document.querySelectorAll('#zoom button')) b.classList.toggle('on', Number(b.dataset.v) === zoom)
    const langs = set === 'all' ? D.all : D.check
    const main = document.querySelector('main')
    main.innerHTML = ''
    if (!D.screens.length) main.innerHTML = '<section><h2>No screens.</h2></section>'
    for (const s of D.screens) {
      const sec = document.createElement('section')
      sec.innerHTML = '<h2></h2><div class="row"></div>'
      sec.querySelector('h2').textContent = s.label
      const code = document.createElement('code'); code.textContent = s.path; sec.querySelector('h2').append(code)
      for (const l of langs) {
        const f = document.createElement('div')
        f.className = 'frame'
        f.style.width = s.width * zoom + 'px'
        f.innerHTML = '<div class="label"><b></b><span class="n"></span><span class="miss" hidden></span><button type="button">Copy</button></div><div class="box"><iframe loading="lazy" scrolling="no"></iframe></div>'
        f.querySelector('b').textContent = l
        f.querySelector('.n').textContent = name(l)
        f.querySelector('button').onclick = () => copy(s.label + (l === D.source ? '' : ' in ' + l) + ' (' + s.path + ')')
        const box = f.querySelector('.box')
        const frame = f.querySelector('iframe')
        frame.style.width = s.width + 'px'
        frame.style.height = '844px'
        frame.style.zoom = zoom
        frame.src = '/' + s.path + (l === D.source ? '' : '?lang=' + encodeURIComponent(l))
        const measure = () => {
          try {
            const doc = frame.contentDocument
            frame.style.height = Math.max(doc.documentElement.scrollHeight, 400) + 'px'
            const miss = frame.contentWindow.__stitch2?.missing ?? []
            const m = f.querySelector('.miss')
            m.hidden = !miss.length
            m.textContent = miss.length + ' missing'
            f.querySelector('.n').hidden = !!miss.length && zoom < 0.6
            m.title = miss.map((x) => x.keys).join(', ')
          } catch {}
        }
        frame.addEventListener('load', () => {
          if (theme) try { frame.contentDocument.documentElement.dataset.theme = theme } catch {}
          measure(); setTimeout(measure, 800); setTimeout(measure, 2500)
        })
        sec.querySelector('.row').append(f)
      }
      main.append(sec)
    }
  }
  for (const b of document.querySelectorAll('#set button')) b.onclick = () => { set = b.dataset.v; localStorage.setItem('stitch2-lang-set', set); render() }
  for (const b of document.querySelectorAll('#zoom button')) b.onclick = () => { zoom = Number(b.dataset.v); localStorage.setItem('stitch2-lang-zoom', String(zoom)); render() }
  render()
  </script></body></html>`
}

