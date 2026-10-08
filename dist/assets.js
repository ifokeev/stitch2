/**
 * Makes screens self-contained: downloads every remote image a screen uses (Stitch links its images to
 * Google-hosted URLs, which can fail in other browsers or expire) into design/<folder>/assets/ and points
 * the screen at the local copy. Scripts, styles and fonts stay remote. Safe to run again.
 * Usage: stitch2 localize [path filter…]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { listScreens, ROOT } from './screens.js';
const EXT = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
};
// <img src>, <source srcset> (first candidate) and CSS url(...) pointing at http(s) images.
const PATTERNS = [
    /(<img\b[^>]*?\bsrc=")(https?:\/\/[^"]+)(")/gi,
    /(url\(['"]?)(https?:\/\/[^'")]+)(['"]?\))/gi,
];
const filters = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let downloaded = 0;
let rewritten = 0;
for (const screen of listScreens().filter((s) => !filters.length || filters.some((f) => s.path.includes(f)))) {
    const file = join(ROOT, screen.path);
    let html = readFileSync(file, 'utf8');
    const urls = new Set();
    for (const re of PATTERNS)
        for (const m of html.matchAll(re))
            urls.add(m[2]);
    // Fonts and stylesheets from CDNs are fine to keep remote.
    const images = [...urls].filter((u) => !/fonts\.(googleapis|gstatic)\.com|cdn\.tailwindcss\.com|unpkg\.com/.test(u));
    if (!images.length)
        continue;
    const assetsDir = join(dirname(file), 'assets');
    mkdirSync(assetsDir, { recursive: true });
    for (const url of images) {
        const res = await fetch(url);
        const type = res.headers.get('content-type')?.split(';')[0] ?? '';
        if (!res.ok || !EXT[type]) {
            console.log(`✗ ${screen.path}: ${res.status} ${type || 'unknown type'} for ${url.slice(0, 70)}…`);
            continue;
        }
        const bytes = Buffer.from(await res.arrayBuffer());
        const name = `${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.${EXT[type]}`;
        if (!existsSync(join(assetsDir, name))) {
            writeFileSync(join(assetsDir, name), bytes);
            downloaded++;
        }
        html = html.split(url).join(`assets/${name}`);
        rewritten++;
        console.log(`✓ ${screen.path}: ${url.slice(0, 50)}… → assets/${name}`);
    }
    writeFileSync(file, html);
}
console.log(`${rewritten} image links now local (${downloaded} new files).`);
