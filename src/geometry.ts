/**
 * Where things sit in the live app against the approved screens. look compares how text is drawn; geometry compares
 * where it and the shared components land: the size of each box, its left edge, and the space between neighbours
 * (a title that wraps under its icon, a button pushed against the text above, a card a few pixels narrower). Boxes
 * are paired by what they hold, so data that differs is skipped, and the page is measured at every width a layout can
 * change at, not only the one the screen is drawn at.
 *
 * Each version is measured at the width it is drawn at, at both ends of its variant's width range and at every
 * breakpoint inside it (the widths check renders); --width narrows that to the widths you give, and --drawn to the
 * width each version is drawn at. The first differences in document order are shown (what sits further down often
 * moves because of them); all are in <design>/geometry.json.
 *
 * Usage: stitch2 geometry [screen…] [--width 360,1280 | --drawn] [--strict]
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { boxes, compareBoxes } from './boxes.ts'
import { config, ROOT } from './config.ts'
import { openLive, screenArgs, scrollThrough, widthsFor } from './live.ts'

const SHOWN = 6
const args = process.argv.slice(2)
const strict = args.includes('--strict')
const live = await openLive('geometry', screenArgs(args))
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
    const found = compareBoxes(await opened.design.evaluate(boxes, config.prefix), await opened.live.evaluate(boxes, config.prefix))
    total += found.mismatches.length
    results.push({ screen: s.screen, device: s.device, version: s.version, width, ...found })
    console.log(`${found.mismatches.length ? '✗' : '✓'} ${`${base} @${width}`.padEnd(34)} ${found.matched} boxes matched${found.mismatches.length ? `, ${found.mismatches.length} differ` : ''}`)
    for (const m of found.mismatches.slice(0, SHOWN)) console.log(`    ${m.type}: ${m.message}`)
    if (found.mismatches.length > SHOWN) console.log(`    … and ${found.mismatches.length - SHOWN} more`)
  }
}
await live.close()
writeFileSync(join(ROOT, 'geometry.json'), `${JSON.stringify({ measuredAt: new Date().toISOString(), url: live.appUrl, results }, null, 2)}\n`)
console.log(`\n${live.versions.length} versions measured, ${total} differences, ${Math.round((Date.now() - started) / 1000)}s. Details: ${config.designDir}/geometry.json`)
if (strict && total) process.exit(1)
