/**
 * Reports opened in the canvas follow its filters. The canvas posts { stitch2Filter: { paths, label } } to the
 * report: every element with data-path outside paths hides, a data-group hides when none of its rows (other than
 * data-ref ones, the catalog's reference) is left, and #stitch2-filter says what is shown. Opened on its own, a
 * report shows everything. The report asks for the filters with { stitch2Ready: true } once its script runs.
 */
export const filterSnippet = `<style>[hidden] { display: none !important; } #stitch2-filter { color: #e5b54a; font-size: 13px; margin: 8px 0 0; }</style>
<script>
addEventListener('message', (e) => {
  const f = e.origin === location.origin && e.data && e.data.stitch2Filter
  if (!f) return
  const keep = new Set(f.paths)
  for (const el of document.querySelectorAll('[data-path]')) el.hidden = !keep.has(el.dataset.path)
  for (const g of document.querySelectorAll('[data-group]'))
    g.hidden = ![...g.querySelectorAll('[data-path]:not([data-ref])')].some((el) => !el.hidden)
  const left = [...document.querySelectorAll('[data-path]:not([data-ref])')].filter((el) => !el.closest('[hidden]')).length
  const note = document.getElementById('stitch2-filter')
  if (!note) return
  note.hidden = !f.label && left > 0
  note.textContent = left ? 'Filtered as on the canvas: ' + (f.label || 'active screens') : 'Nothing in this report matches the canvas filters' + (f.label ? ': ' + f.label : '') + '.'
})
if (parent !== window) parent.postMessage({ stitch2Ready: true }, location.origin)
</script>`
