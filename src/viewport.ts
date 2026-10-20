/** Runs inside a page. Canvas frames grow to the document, but viewport units
 * must keep describing the original screen rather than that growing frame. */
export function pinViewportHeight(height: number) {
  // shortcut: cross-origin and shadow-root styles keep native units; localize sheets before supporting those screens.
  const freeze = () => {
    const units = /url\(\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:\\.|[^)])*)\s*\)|(["'])(?:\\.|(?!\1)[\s\S])*?\1|(-?(?:\d*\.)?\d+)(?:s|l|d)?v(h|min|max)\b/gi
    const value = (text: string) => text.replace(units, (match, quoted, amount, axis) => {
      if (quoted || amount == null) return match
      const unit = axis.toLowerCase()
      const size = unit === 'h' ? height : unit === 'min' ? Math.min(innerWidth, height) : Math.max(innerWidth, height)
      return `${Number(amount) * size / 100}px`
    })
    const style = (declarations: CSSStyleDeclaration) => {
      for (const property of Array.from(declarations)) {
        const current = declarations.getPropertyValue(property)
        const next = value(current)
        if (next !== current) declarations.setProperty(property, next, declarations.getPropertyPriority(property))
      }
    }
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if ('style' in rule) style((rule as CSSStyleRule).style)
        if ('cssRules' in rule) {
          try { walk((rule as CSSGroupingRule).cssRules) } catch { /* Cross-origin nested rules remain browser-owned. */ }
        }
        if ('styleSheet' in rule) {
          try {
            const imported = (rule as CSSImportRule).styleSheet
            if (imported) walk(imported.cssRules)
          } catch { /* Cross-origin imported sheets remain browser-owned. */ }
        }
      }
    }
    for (const sheet of Array.from(document.styleSheets)) {
      try { walk(sheet.cssRules) } catch { /* Cross-origin sheets remain browser-owned. */ }
    }
    for (const element of document.querySelectorAll<HTMLElement>('[style]')) style(element.style)
  }
  let pending = false
  const schedule = () => {
    if (pending) return
    pending = true
    requestAnimationFrame(() => { pending = false; freeze() })
  }
  // Fonts, async style links and browser-built Tailwind can arrive after DOMContentLoaded.
  document.addEventListener('DOMContentLoaded', freeze, { once: true })
  document.addEventListener('load', freeze, true)
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style'],
    childList: true,
    subtree: true,
  })
  freeze()
}
