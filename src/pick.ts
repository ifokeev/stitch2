/**
 * Element picking on the canvas. When the canvas loads a screen (with ?pick), every element in its body gets
 * data-s2-line, its line in the source file, and a small script carries that attribute over to the markup a
 * custom element renders in its place (a light-DOM component that replaces itself keeps its source line). The
 * canvas reads the attribute to highlight an element and copy a reference such as
 *   home mobile v1 (design/screens/home/mobile-v1.html:37) <gg-button> “Start Push”
 * The source file is never changed, and nothing is added to the lines above the body.
 */

/** Tags that are never picked by themselves: their nearest picked ancestor stands for them. */
const SKIP = new Set(['body', 'br', 'i', 'script', 'style', 'template', 'path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'rect', 'g', 'defs', 'stop', 'use', 'text', 'tspan'])

/** Runs in the screen before its own scripts: components that replace themselves pass their line on. */
const SHIM = `<script>(()=>{const d=customElements.define.bind(customElements);customElements.define=(name,cls,opts)=>{const p=cls.prototype,cb=p.connectedCallback;if(cb)p.connectedCallback=function(...a){const line=this.getAttribute('data-s2-line'),parent=this.parentNode,before=this.previousSibling,after=this.nextSibling;const r=cb.apply(this,a);if(line){const key=this.getAttribute('data-s2-key');if(this.isConnected)this.setAttribute('data-s2-tag',name);else if(parent)for(let n=before?before.nextSibling:parent.firstChild;n&&n!==after;n=n.nextSibling)if(n.nodeType===1&&!n.hasAttribute('data-s2-line')){n.setAttribute('data-s2-line',line);n.setAttribute('data-s2-tag',name);if(key)n.setAttribute('data-s2-key',key)}}return r};return d(name,cls,opts)}})()</script>`

/** The page with source lines on its body's elements and the shim at the start of its head. */
export function annotate(html: string): string {
  const bodyAt = html.search(/<body[\s>]/i)
  if (bodyAt < 0) return html
  let line = html.slice(0, bodyAt).split('\n').length
  let out = html.slice(0, bodyAt)
  let last = bodyAt
  const re = /<!--[\s\S]*?-->|<(script|style|textarea)\b[\s\S]*?<\/\1\s*>|<([a-zA-Z][\w-]*)/g
  re.lastIndex = bodyAt
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const chunk = html.slice(last, m.index)
    line += chunk.split('\n').length - 1
    out += chunk
    const tag = m[2]?.toLowerCase()
    if (m[1] === 'textarea') out += m[0].replace(/^<textarea/i, `<textarea data-s2-line="${line}"`)
    else out += tag && !SKIP.has(tag) ? `${m[0]} data-s2-line="${line}"` : m[0]
    line += m[0].split('\n').length - 1
    last = m.index + m[0].length
  }
  out += html.slice(last)
  // On the head's own line, so the body's line numbers stay those of the file.
  return out.replace(/<head(\s[^>]*)?>/i, (h) => h + SHIM)
}

