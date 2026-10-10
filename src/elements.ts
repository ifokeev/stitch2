/**
 * Shared components for screens: turns a project's own components (React, Preact, Vue, Solid, …) into the
 * <prefix>-<name> elements stitch2 screens use, so a screen shows exactly the markup the app renders. Each
 * element renders once into plain markup in the page (no shadow DOM, so the checks, pick mode and Tailwind
 * see it), marks its root data-<prefix>="<name>" (plus data-variant and data-size from those props), and
 * keeps the screen's source line for pick mode.
 *
 *   import { createElement } from 'react'
 *   import { renderToStaticMarkup } from 'react-dom/server'
 *   import { defineElements } from 'stitch2/elements'
 *   import { Button, Row } from './ui'
 *   defineElements({ button: Button, row: Row }, {
 *     prefix: 'gg',
 *     render: (C, props) => renderToStaticMarkup(createElement(C, props)),
 *   })
 *
 * Attributes become props: kebab-case to camelCase, an empty attribute (<gg-row chevron>) is true, other
 * values stay strings. The element's content becomes children, rendered where the component puts them.
 * Bundle the entry with `stitch2 elements <entry>› and load the bundle in the screens and the template.
 */

export interface ElementsOptions<C> {
  /** The project's prefix (stitch2.config.json): elements are <prefix>-<name>. */
  prefix: string
  /**
   * Renders one component with its props to static HTML; props.children is a placeholder string. Synchronous
   * (React, Preact, Solid) or a promise (Vue's renderToString).
   */
  render: (component: C, props: Record<string, unknown>) => string | Promise<string>
  /** Runs after every element has rendered, e.g. to draw icon placeholders (lucide.createIcons). */
  after?: () => void
}

/**
 * A message in the locale the screen is shown in (the canvas's Language switch), for labels a component draws
 * itself. Without one (the source language, or outside stitch2) it returns the fallback.
 *
 *   render: (C, props) => renderToStaticMarkup(createElement(C, { labels: { home: translate('nav.home', 'Home') }, ...props }))
 */
export function translate(key: string, fallback: string, args?: Record<string, string>): string {
  const s = (globalThis as { __stitch2?: { t: (k: string, a?: Record<string, string>) => string | undefined } }).__stitch2
  return s?.t(key, args) ?? fallback
}

/** The locale the screen is shown in ("en", "ru", "ar-XB" for the right-to-left pseudo-language), or undefined. */
export const screenLocale = (): string | undefined =>
  (globalThis as { __stitch2?: { lang: string } }).__stitch2?.lang

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

export function defineElements<C>(components: Record<string, C>, options: ElementsOptions<C>): void {
  const { prefix, render } = options
  let pending = 0
  for (const [name, component] of Object.entries(components)) {
    const tag = `${prefix}-${name}`
    if (customElements.get(tag)) continue
    customElements.define(
      tag,
      class extends HTMLElement {
        connectedCallback() {
          const props: Record<string, unknown> = {}
          for (const a of Array.from(this.attributes)) {
            // stitch2's own markers and the message keys (i18n.ts translated them already) are not props.
            if (a.name.startsWith('data-s2-') || a.name === 'data-t' || a.name.startsWith('data-t-')) continue
            props[camel(a.name)] = a.value === '' ? true : a.value
          }
          const inner = this.innerHTML.trim()
          const token = `s2children${Math.random().toString(36).slice(2)}`
          if (inner) props.children = token
          const out = render(component, props)
          if (typeof out === 'string') this.mount(out, inner, token, props)
          else void out.then((html) => this.mount(html, inner, token, props))
        }
        mount(html: string, inner: string, token: string, props: Record<string, unknown>) {
          if (inner) html = html.replace(token, inner)
          const t = document.createElement('template')
          t.innerHTML = html
          const root = t.content.firstElementChild
          if (root) {
            if (!root.hasAttribute(`data-${prefix}`)) root.setAttribute(`data-${prefix}`, name)
            for (const key of ['variant', 'size'])
              if (typeof props[key] === 'string' && !root.hasAttribute(`data-${key}`))
                root.setAttribute(`data-${key}`, props[key] as string)
          }
          this.replaceWith(t.content)
          if (options.after && !pending++)
            queueMicrotask(() => {
              pending = 0
              options.after?.()
            })
        }
      },
    )
  }
}

