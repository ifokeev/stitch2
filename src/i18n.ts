/**
 * Languages for screens. A screen is written in the source language and marks the text that belongs to the product
 * with message keys from the project's own translation files:
 *
 *   <span data-t="nav.library">Exercises</span>                 the element's text
 *   <gg-header title="Settings" data-t-title="settings.title">  an attribute (also comma lists: data-t-options)
 *   <p data-t="count.sets" data-t-args="count=16">16 sets</p>   {count} filled in, plural form picked by count
 *   <x-row meta="5 exercises · Linear" data-t-meta="{plan.count|count=5} · {plan.linear}">
 *                                                                a template: messages in braces, the rest kept
 *   <x-row meta="Sun, 4 Oct" data-t-meta="{@date|value=2026-10-04;weekday=short;day=numeric;month=short}">
 *                                                                dates and numbers ({@number|value=7920}) by Intl
 *
 * Opened with ?lang=<locale> (the canvas's Language switch, and check), the page's text is replaced from that
 * locale's messages before its components render, and the page gets lang and dir. Two pseudo-languages need no
 * translations: "pseudo" makes every text about 40% longer with accented letters, "pseudo-rtl" lays the page out
 * right to left. Project components can read the same messages with translate() from stitch2/elements.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BASE, config, type I18nConfig } from './config.ts'

export type { I18nConfig }

export const PSEUDO = ['pseudo', 'pseudo-rtl'] as const
const RTL = ['ar', 'he', 'fa', 'ur', 'ps', 'yi']

export const i18nConfig = (): I18nConfig => config.i18n ?? {}
export const sourceLocale = () => i18nConfig().source ?? 'en'
export const realLocales = () => i18nConfig().locales?.filter((l) => l !== sourceLocale()) ?? []
export const isRtl = (locale: string) =>
  locale === 'pseudo-rtl' || (i18nConfig().rtl ?? RTL).includes(locale.split('-')[0]!.toLowerCase())

/** Every language the canvas offers: the source, the pseudo-languages, and the project's own. */
export const allLocales = () => [sourceLocale(), ...PSEUDO, ...realLocales()]

/** The locales check runs: with an i18n block, the pseudo-languages plus the configured ones; else only --locales. */
export function checkLocales(override?: string): string[] {
  if (override === 'none') return []
  const list = override ? (override === 'all' ? [...PSEUDO, ...realLocales()] : override.split(',')) : undefined
  if (list) return list.filter((l) => l !== sourceLocale())
  if (!config.i18n) return []
  const c = i18nConfig().check
  return [...PSEUDO, ...(c === 'all' ? realLocales() : (c ?? []))]
}

function messagesFile(locale: string): string | undefined {
  const m = i18nConfig().messages
  if (!m) return undefined
  const pattern = typeof m === 'string' ? m : (m[locale] ?? m['*'])
  return pattern ? resolve(BASE, pattern.replaceAll('{locale}', locale)) : undefined
}

/** Nested objects become dotted keys; only strings are kept. */
function flatten(o: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (o && typeof o === 'object')
    for (const [k, v] of Object.entries(o)) {
      const key = prefix ? prefix + '.' + k : k
      if (typeof v === 'string') out[key] = v
      else flatten(v, key, out)
    }
  return out
}

const cache = new Map<string, { at: number; messages: Record<string, string> }>()

/**
 * A locale's messages: JSON, or a JS/TS module (its default export, else its first exported object; Node strips
 * the types). Re-read when the file changes. Empty when the file is missing.
 */
export async function loadMessages(locale: string): Promise<Record<string, string>> {
  const file = messagesFile(locale)
  if (!file || !existsSync(file)) return {}
  const at = statSync(file).mtimeMs
  const hit = cache.get(file)
  if (hit && hit.at === at) return hit.messages
  let data: unknown
  if (extname(file) === '.json') data = JSON.parse(readFileSync(file, 'utf8'))
  else {
    const mod = (await import(pathToFileURL(file).href + '?t=' + at)) as Record<string, unknown>
    data = mod.default ?? Object.values(mod).find((v) => v && typeof v === 'object')
  }
  const messages = flatten(data)
  cache.set(file, { at, messages })
  return messages
}

/** What a page needs to show a locale: its messages over the source language's, and its direction. */
export async function pagePayload(locale: string) {
  const pseudo = (PSEUDO as readonly string[]).includes(locale)
  const source = await loadMessages(sourceLocale())
  const own = pseudo || locale === sourceLocale() ? {} : await loadMessages(locale)
  return {
    locale,
    lang: locale === 'pseudo' ? sourceLocale() + '-XA' : locale === 'pseudo-rtl' ? 'ar-XB' : locale,
    dir: isRtl(locale) ? 'rtl' : 'ltr',
    pseudo: locale === 'pseudo',
    // Keys the locale lacks fall back to the source language, and are reported.
    messages: { ...source, ...own },
    missing: pseudo || locale === sourceLocale() ? [] : Object.keys(source).filter((k) => !(k in own)),
  }
}

/** Runs in the page. Plain JS on purpose: it is sent as source into the screen's head. */
function runtime(p: Awaited<ReturnType<typeof pagePayload>>) {
  const missing = new Set(p.missing)
  const plural = new Intl.PluralRules(p.lang)
  // {@date|value=…;weekday=short…} and {@number|value=…;maximumFractionDigits=1…}: Intl's options, in the locale.
  const intl = (key: string, args: Record<string, string>) => {
    const opts: Record<string, string | number | boolean> = {}
    for (const [k, v] of Object.entries(args))
      if (k !== 'value') opts[k] = v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? Number(v) : v
    try {
      return key === '@date'
        ? // As written, whatever the viewer's time zone: the value is read and shown in UTC.
          new Intl.DateTimeFormat(p.lang, { timeZone: 'UTC', ...opts }).format(
            new Date(/T.*(Z|[+-]\d\d:?\d\d)$/.test(args.value ?? '') || !/T/.test(args.value ?? '') ? (args.value ?? '') : args.value + 'Z'),
          )
        : new Intl.NumberFormat(p.lang, opts).format(Number(args.value))
    } catch {
      return undefined
    }
  }
  const t = (key: string, args?: Record<string, string>) => {
    if (key === '@date' || key === '@number') return intl(key, args ?? {})
    let msg: string | undefined
    if (args && args.count !== undefined) {
      const n = Number(args.count)
      msg = p.messages[key + '.' + plural.select(n)] ?? p.messages[key + '.other']
    }
    msg = msg ?? p.messages[key]
    if (msg === undefined) return undefined
    return msg.replace(/\{(\w+)\}/g, (m: string, k: string) => (args && args[k] !== undefined ? args[k]! : m))
  }
  const known = (key: string) =>
    key.startsWith('@') || key in p.messages || key + '.other' in p.messages
  const lacks = (key: string) => missing.has(key) || missing.has(key + '.other') || !known(key)
  const parseArgs = (s: string | null | undefined, sep = ',') => {
    const out: Record<string, string> = {}
    for (const part of (s ?? '').split(sep)) {
      const i = part.indexOf('=')
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
    }
    return out
  }
  const lostList: { keys: string; all: string; text: string; unknown: string }[] = []
  ;(window as unknown as { __stitch2: unknown }).__stitch2 = { locale: p.locale, lang: p.lang, dir: p.dir, t, missing: lostList }
  document.documentElement.lang = p.lang
  document.documentElement.dir = p.dir

  let done = false
  const translate = () => {
    if (done) return
    done = true
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const keys: string[] = []
      for (const a of Array.from(el.attributes)) {
        if (a.name !== 'data-t' && !a.name.startsWith('data-t-')) continue
        if (a.name === 'data-t-args' || a.name === 'data-t-skip') continue
        const args = parseArgs(el.getAttribute('data-t-args'))
        let v: string | undefined
        if (a.value.includes('{')) {
          // A template: each {key} or {key|name=value;name=value} becomes its message, the rest stays as written.
          let whole = true
          v = a.value.replace(/\{([^{}|]+)(?:\|([^}]*))?\}/g, (_m: string, key: string, inline?: string) => {
            keys.push(key)
            const r = t(key, { ...args, ...parseArgs(inline, ';') })
            if (r === undefined) whole = false
            return r ?? ''
          })
          if (!whole) v = undefined
        } else if (a.name === 'data-t') {
          v = t(a.value, args)
          keys.push(a.value)
        } else {
          // A list attribute (options="A,B"): one key per item.
          const parts = a.value.split(',').map((k) => k.trim())
          const vals = parts.map((k) => t(k, args))
          if (vals.every((x) => x !== undefined)) v = vals.join(',')
          keys.push(...parts)
        }
        if (v === undefined) continue
        if (a.name === 'data-t') el.textContent = v
        else el.setAttribute(a.name.slice(7), v)
      }
      if (!keys.length) continue
      el.setAttribute('data-s2-key', keys.join(' '))
      const lost = keys.filter(lacks)
      if (lost.length) {
        el.setAttribute('data-s2-i18n-missing', lost.join(' '))
        lostList.push({
          keys: lost.join(' '),
          all: keys.join(' '),
          text: (el.textContent ?? '').trim().slice(0, 60),
          // Not even in the source language: the screen shows its own text in every language.
          unknown: lost.filter((k) => !known(k)).join(' '),
        })
      }
    }
  }

  // Pseudo-language: every visible text, accented and about 40% longer, bracketed so a cut end shows.
  const MAP: Record<string, string> = {
    a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ', n: 'ñ',
    o: 'ó', p: 'þ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ú', w: 'ŵ', y: 'ý', z: 'ž',
    A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', N: 'Ñ', O: 'Ó',
    R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ú', W: 'Ŵ', Y: 'Ý', Z: 'Ž',
  }
  const seen = new WeakSet<Node>()
  const stretch = (s: string) => {
    const core = s.trim()
    if (!/\p{L}/u.test(core)) return s
    const extra = Math.max(1, Math.round(core.length * 0.3))
    const lead = s.slice(0, s.indexOf(core))
    return lead + '[' + core.replace(/[A-Za-z]/g, (c) => MAP[c] ?? c) + ' ' + '·'.repeat(extra) + ']' + s.slice(lead.length + core.length)
  }
  const SKIP = 'script,style,code,pre,textarea,[data-t-skip],svg'
  const pseudoAll = (root: Node) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (seen.has(n) || n.parentElement?.closest(SKIP)) continue
      seen.add(n)
      n.textContent = stretch(n.textContent ?? '')
    }
    if (root instanceof Element || root instanceof Document)
      for (const el of Array.from((root as ParentNode).querySelectorAll('[placeholder]'))) {
        if (el.hasAttribute('data-s2-pseudo')) continue
        el.setAttribute('data-s2-pseudo', '')
        el.setAttribute('placeholder', stretch(el.getAttribute('placeholder') ?? ''))
      }
  }

  // Translate once the body is parsed and before components render: the first customElements.define (the
  // components' deferred bundle) or DOMContentLoaded, whichever comes first.
  const define = customElements.define.bind(customElements)
  customElements.define = (name: string, cls: CustomElementConstructor, opts?: ElementDefinitionOptions) => {
    translate()
    return define(name, cls, opts)
  }
  document.addEventListener('DOMContentLoaded', () => {
    translate()
    if (!p.pseudo) return
    pseudoAll(document.body)
    new MutationObserver((list) => {
      for (const m of list) for (const n of Array.from(m.addedNodes)) pseudoAll(n)
    }).observe(document.body, { childList: true, subtree: true })
  })
}

/** The script for a screen opened in a locale; serve adds it after pick mode has numbered the lines. */
export async function localeScript(locale: string): Promise<string> {
  const payload = await pagePayload(locale)
  const json = JSON.stringify(payload).replaceAll('<', '\\u003c')
  return '<script>(' + runtime.toString() + ')(' + json + ')</script>'
}
