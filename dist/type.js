/**
 * Typography audit: renders each screen and lists every distinct text style it uses (family, size, line
 * height, weight, tracking, colour, case), how often, a sample, and which DESIGN.md type level it matches
 * ("—" when none). Use it to compare type systems (Stitch versus hand-made screens) and to find stray styles.
 * Usage: stitch2 type [path filter…] [--json]   (--json writes design/type-audit.json)
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { typeLevels } from './design-md.js';
import { listScreens, ROOT } from './screens.js';
import { startServer } from './serve.js';
import { collectText, matchLevel } from './typecheck.js';
const key = (t) => `${t.family} ${t.size}/${Math.round(t.lineHeight)} w${t.weight}${t.tracking ? ` ${(t.tracking / t.size).toFixed(3)}em` : ''}${t.upper ? ' CAPS' : ''} ${t.color}`;
const args = process.argv.slice(2);
const filters = args.filter((a) => !a.startsWith('--'));
const screens = listScreens().filter((s) => !filters.length || filters.some((f) => s.path.includes(f)));
const levels = typeLevels();
const server = await startServer(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const report = {};
for (const s of screens) {
    await page.setViewportSize({ width: s.width, height: 844 });
    await page
        .goto(`http://127.0.0.1:${server.port}/${s.path}`, { waitUntil: 'networkidle', timeout: 30_000 })
        .catch(() => { });
    await page.waitForTimeout(600);
    const styles = new Map();
    for (const t of await page.evaluate(collectText)) {
        const k = key(t);
        const hit = styles.get(k);
        if (hit)
            hit.count++;
        else
            styles.set(k, {
                key: k,
                level: matchLevel(levels, t)?.name ?? '—',
                count: 1,
                numeric: t.numeric,
                sample: t.text,
                item: t,
            });
    }
    report[s.path] = [...styles.values()].sort((a, b) => b.item.size - a.item.size || b.item.weight - a.item.weight);
}
await browser.close();
server.close();
if (args.includes('--json'))
    writeFileSync(join(ROOT, 'type-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
const uniq = (xs) => [...new Set(xs)];
for (const [path, styles] of Object.entries(report)) {
    const texts = styles.reduce((n, s) => n + s.count, 0);
    const onScale = styles.filter((s) => s.level !== '—').reduce((n, s) => n + s.count, 0);
    console.log(`\n${path}: ${styles.length} styles, ${Math.round((onScale / texts) * 100)}% of text on the scale; sizes ${uniq(styles.map((s) => s.item.size)).join('/')}, weights ${uniq(styles.map((s) => s.item.weight))
        .sort()
        .join('/')}, colours ${uniq(styles.map((s) => s.item.color)).length}`);
    for (const s of styles)
        console.log(`  ${String(s.count).padStart(3)}×  ${s.level.padEnd(14)} ${s.key.padEnd(52)} ${s.numeric ? '#' : ' '} “${s.sample}”`);
}
