/**
 * How the live app's text looks against the approved screens. compare says which components are there; look says
 * whether the words in them are drawn the same: for every piece of text the screen and the app share, the font,
 * size, weight, letter spacing, line height, case, alignment, decoration and colour. Text is matched by its words
 * (the nth time a phrase appears on the screen is the nth time it appears in the app), so data that differs between
 * a mock-up and the app is left out: a phrase on one side only is counted, not reported.
 *
 * Each version is looked at the width it is drawn at, at both ends of its variant's width range and at every
 * breakpoint inside it (the widths check renders); --width narrows that to the widths you give, and --drawn to the
 * width each version is drawn at. The same difference on many texts is one line with a count. Writes
 * <design>/look.json.
 *
 * Usage: stitch2 look [screen…] [--width 360,1280 | --drawn] [--strict]
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config, ROOT } from './config.ts'
import { openLive, screenArgs, scrollThrough, widthsFor } from './live.ts'
import { lookAt, texts } from './looks.ts'

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const live = await openLive('look', screenArgs(args))
const results: unknown[] = []
let total = 0
const started = Date.now()
for (const s of live.versions) {
  const opened = await live.open(s)
  const base = `${s.screen}-${s.device}`
  if (opened.prepareError) {
    console.log(`✗ ${base}: ${opened.prepareError}`)
    total++
  }
  let at = s.width
  for (const width of widthsFor(s, args)) {
    if (width !== at) await live.resize(width)
    at = width
    await scrollThrough(opened.design)
    await scrollThrough(opened.live)
    const found = lookAt(await opened.design.evaluate(texts, config.prefix), await opened.live.evaluate(texts, config.prefix))
    total += found.differences.length
    results.push({ screen: s.screen, device: s.device, version: s.version, width, ...found })
    const extra = found.onlyApp.length || found.onlyDesign.length ? ` (${found.onlyApp.length} only in the app, ${found.onlyDesign.length} only in the design)` : ''
    console.log(`${found.differences.length ? '✗' : '✓'} ${`${base} @${width}`.padEnd(34)} ${found.matched} texts matched${extra}`)
    for (const d of found.differences.slice(0, 8))
      console.log(`    ${d.count > 1 ? `×${d.count} ` : ''}${d.what} — ${d.texts.map((t) => `“${t.slice(0, 28)}”`).join(', ')} (app: ${d.at})`)
    if (found.differences.length > 8) console.log(`    … and ${found.differences.length - 8} more kinds of difference`)
  }
}
await live.close()
writeFileSync(join(ROOT, 'look.json'), `${JSON.stringify({ lookedAt: new Date().toISOString(), url: live.appUrl, results }, null, 2)}\n`)
console.log(`\n${live.versions.length} versions looked at, ${total} differences, ${Math.round((Date.now() - started) / 1000)}s. Details: ${config.designDir}/look.json`)
if (strict && total) process.exit(1)
