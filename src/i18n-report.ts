/**
 * How far the screens are translated, for agents writing them in several languages:
 *
 *   stitch2 i18n [filter] [--locale l] [--suggest] [--json]
 *
 * Errors: keys screens use (data-t, data-t-<attr>) that the source messages lack, which show the screen's own
 * text in every language. Warnings: keys a locale lacks (they fall back to the source language), translations
 * whose {placeholders} differ from the source's, and product text in screens with no key. Text that is sample
 * content (names, numbers, user input) opts out with translate="no" or data-t-skip. --suggest names source
 * messages with the same text as an unkeyed one. Archived screens are skipped. Exits 1 on errors.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './config.ts'
import { loadMessages, realLocales, sourceLocale } from './i18n.ts'
import { listScreens } from './screens.ts'

const args = process.argv.slice(2)
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined)
const filter = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--locale')
const locales = opt('--locale')?.split(',') ?? realLocales()
const suggest = args.includes('--suggest')

/** Attributes that hold text people read. On components (a dash in the tag) any attribute that reads as words. */
const TEXT_ATTRS = new Set(['title', 'label', 'placeholder', 'aria-label', 'alt'])
const NOT_TEXT = /^(class|id|style|href|src|srcset|type|name|value|for|role|slot|lang|dir|icon|variant|tone|size|width|height|viewbox|d|fill|stroke|xmlns|rel|target|tabindex|loading|translate)$/
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const words = (s: string) => /\p{L}{2,}/u.test(s)
const readsAsText = (s: string) => words(s) && (/\s/.test(s.trim()) || /\p{Lu}/u.test(s) || /[^\x00-\x7f]/.test(s))

interface Use { key: string; line: number; plural: boolean }
interface Loose { text: string; line: number; attr?: string; suggest?: string[] }

function attrsOf(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of s.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))
    out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
  return out
}

/** The keys a screen uses and its text with no key, from its markup (scripts, styles and SVG left out). */
export function scan(html: string): { uses: Use[]; loose: Loose[] } {
  const uses: Use[] = []
  const loose: Loose[] = []
  const body = html.replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi, (m) => m.replace(/[^\n]/g, ' '))
  const start = body.search(/<body\b/i)
  const lineAt = (i: number) => body.slice(0, i).split('\n').length
  const stack: { tag: string; keyed: boolean; skip: boolean }[] = []
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>|([^<]+)/g
  re.lastIndex = Math.max(0, start)
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const line = lineAt(m.index)
    const top = stack[stack.length - 1]
    if (m[5] !== undefined) {
      const text = m[5].replace(/\s+/g, ' ').trim()
      if (words(text) && !top?.keyed && !top?.skip) loose.push({ text: text.replaceAll('&amp;', '&'), line })
      continue
    }
    const tag = m[2]!.toLowerCase()
    if (m[1]) {
      const at = stack.map((s) => s.tag).lastIndexOf(tag)
      if (at >= 0) stack.length = at
      continue
    }
    const a = attrsOf(m[3]!)
    const plural = 'data-t-args' in a && /(^|,)\s*count\s*=/.test(a['data-t-args']!)
    const skip = !!top?.skip || 'data-t-skip' in a || a.translate === 'no'
    for (const [name, value] of Object.entries(a)) {
      if (name === 'data-t') uses.push({ key: value, line, plural })
      else if (name.startsWith('data-t-') && name !== 'data-t-args' && name !== 'data-t-skip')
        for (const k of value.split(',')) uses.push({ key: k.trim(), line, plural })
      else if (!skip && !name.startsWith('data-') && !NOT_TEXT.test(name) && !('data-t-' + name in a)) {
        const textual = TEXT_ATTRS.has(name) ? words(value) : tag.includes('-') && readsAsText(value)
        if (textual) loose.push({ text: value, line, attr: name })
      }
    }
    if (!m[4] && !VOID.has(tag)) stack.push({ tag, keyed: !!top?.keyed || 'data-t' in a, skip })
  }
  return { uses, loose }
}

const has = (msgs: Record<string, string>, u: Use) => u.key in msgs || (u.plural && u.key + '.other' in msgs)
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

const source = await loadMessages(sourceLocale())
const byLocale = Object.fromEntries(await Promise.all(locales.map(async (l) => [l, await loadMessages(l)] as const)))
const byText = new Map<string, string[]>()
for (const [k, v] of Object.entries(source)) {
  const n = v.trim().toLowerCase()
  byText.set(n, [...(byText.get(n) ?? []), k])
}

const screens = listScreens().filter(
  (s) => s.kind === 'screen' && s.status !== 'archived' && (!filter || s.path.includes(filter) || s.screen === filter),
)
const report = screens.map((s) => {
  const { uses, loose } = scan(readFileSync(join(ROOT, s.path), 'utf8'))
  const unknown = uses.filter((u) => !has(source, u))
  const missing: Record<string, string[]> = {}
  const placeholders: { locale: string; key: string }[] = []
  for (const l of locales) {
    const msgs = byLocale[l]!
    const lacks = [...new Set(uses.filter((u) => has(source, u) && !has(msgs, u)).map((u) => u.key))]
    if (lacks.length) missing[l] = lacks
    for (const u of uses)
      if (u.key in msgs && u.key in source && holes(msgs[u.key]!) !== holes(source[u.key]!))
        placeholders.push({ locale: l, key: u.key })
  }
  if (suggest) for (const x of loose) x.suggest = byText.get(x.text.toLowerCase())
  return { path: s.path, keys: new Set(uses.map((u) => u.key)).size, unknown, missing, placeholders, loose }
})

if (args.includes('--json')) console.log(JSON.stringify({ source: sourceLocale(), locales, screens: report }, null, 2))
else {
  if (!Object.keys(source).length)
    console.log('No source messages: set i18n.messages in stitch2.config.json (see the stitch2-i18n skill).\n')
  for (const r of report) {
    const lines: string[] = []
    for (const u of r.unknown) lines.push(`  error  line ${u.line}: ${u.key} is not in the ${sourceLocale()} messages`)
    for (const [l, keys] of Object.entries(r.missing)) lines.push(`  warn   ${l} lacks ${keys.length}: ${keys.join(', ')}`)
    for (const p of r.placeholders) lines.push(`  warn   ${p.locale} ${p.key}: placeholders differ from ${sourceLocale()}`)
    for (const x of r.loose)
      lines.push(
        `  text   line ${x.line}${x.attr ? ` [${x.attr}]` : ''}: "${x.text.slice(0, 60)}" has no key${x.suggest ? ` (${x.suggest.join(' or ')}?)` : ''}`,
      )
    console.log(`${r.path}  ${r.keys} keys${lines.length ? '' : ', all translated'}`)
    if (lines.length) console.log(lines.join('\n'))
  }
  const errors = report.reduce((n, r) => n + r.unknown.length, 0)
  const loose = report.reduce((n, r) => n + r.loose.length, 0)
  const lacking = locales.filter((l) => report.some((r) => r.missing[l]))
  console.log(
    `\n${screens.length} screens, ${errors} unknown keys, ${loose} texts with no key${lacking.length ? `, missing translations in ${lacking.join(', ')}` : ''}.`,
  )
}
if (report.some((r) => r.unknown.length)) process.exitCode = 1

