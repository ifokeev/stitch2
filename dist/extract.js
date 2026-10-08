/**
 * Writes a DESIGN.md measured from an existing site or screen, the way Stitch builds a design system from a
 * website: renders each page at 390px in Chromium, measures the colours (backgrounds by area, text by amount),
 * the fonts, every text style, corner radii and the page padding, maps them to roles and type levels, and fills
 * what it could not measure from the generated scale.
 *   stitch2 extract <url or .html file…> [--name N] [--mood "…"] [--out file] [--force]
 * Then read the result, correct what was guessed, and refine the prose.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { tracking } from './build-design.js';
import { choicesFrom, parseArgs, writeDesign } from './init.js';
import { collectText } from './typecheck.js';
/** Runs in the page. Plain JS on purpose: Playwright sends its source to the browser. */
function measure() {
    const hex = (c) => {
        const m = c.match(/[\d.]+/g);
        if (!m || (m[3] !== undefined && Number(m[3]) < 0.9))
            return '';
        return `#${m
            .slice(0, 3)
            .map((v) => Math.round(Number(v)).toString(16).padStart(2, '0'))
            .join('')}`;
    };
    const add = (o, k, n) => {
        if (k)
            o[k] = (o[k] ?? 0) + n;
    };
    const out = { backgrounds: {}, borders: {}, accents: {}, radii: {}, lefts: {} };
    add(out.backgrounds, hex(getComputedStyle(document.body).backgroundColor) ||
        hex(getComputedStyle(document.documentElement).backgroundColor) ||
        '#ffffff', innerWidth * innerHeight);
    for (const el of document.body.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || cs.visibility === 'hidden')
            continue;
        const bg = hex(cs.backgroundColor);
        if (bg)
            add(out.backgrounds, bg, Math.min(r.width * r.height, innerWidth * innerHeight));
        if (Number.parseFloat(cs.borderTopWidth) >= 1)
            add(out.borders, hex(cs.borderTopColor), 1);
        // Filled controls carry the brand colour.
        if (bg && el.matches('button, a, [role=button]') && (el.textContent ?? '').trim())
            add(out.accents, bg, 1);
        const radius = Number.parseFloat(cs.borderTopLeftRadius);
        if (radius > 0 && radius < 200 && (bg || Number.parseFloat(cs.borderTopWidth) >= 1) && r.width >= 200)
            add(out.radii, String(Math.round(radius)), 1);
        // Page padding: where wide surfaces (cards, fields) start.
        if ((bg || Number.parseFloat(cs.borderTopWidth) >= 1) && r.width >= 200 && r.left > 0 && r.left < 48)
            add(out.lefts, String(Math.round(r.left)), 1);
    }
    return out;
}
const args = parseArgs(process.argv.slice(2));
const sources = process.argv
    .slice(2)
    .filter((a, i, all) => !a.startsWith('--') && !(all[i - 1]?.startsWith('--') && !(all[i - 1] === '--force')));
if (!sources.length) {
    console.error('usage: stitch2 extract <url or .html file…> [--name N] [--mood "…"] [--out file] [--force]');
    process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const m = { backgrounds: {}, borders: {}, accents: {}, radii: {}, lefts: {} };
const texts = [];
for (const src of sources) {
    const url = /^https?:/.test(src) ? src : pathToFileURL(resolve(src)).href;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => { });
    await page.waitForTimeout(800);
    const one = await page.evaluate(measure);
    for (const k of Object.keys(m))
        for (const [v, n] of Object.entries(one[k]))
            m[k][v] = (m[k][v] ?? 0) + n;
    texts.push(...(await page.evaluate(collectText)));
}
await browser.close();
const ranked = (o) => Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
const lum = (hex) => {
    const c = [1, 3, 5]
        .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const chroma = (hex) => {
    const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    return Math.max(...c) - Math.min(...c);
};
// Surfaces: the most-covered backgrounds that are not the brand colour, in order of area.
const bgs = ranked(m.backgrounds).filter((c) => chroma(c) < 40);
const background = bgs[0] ?? '#ffffff';
const mode = lum(background) < 0.4 ? 'dark' : 'light';
const primary = ranked(m.accents).find((c) => chroma(c) >= 40) ??
    ranked(m.backgrounds).find((c) => chroma(c) >= 40) ??
    '#2F6FEB';
// Text: by amount, plain text colours (alpha-free), the most common is text, the next readable grey is muted.
const weight = (t) => Math.max(1, t.text.length);
const textColours = {};
for (const t of texts)
    if (!t.color.includes('%'))
        textColours[t.color] = (textColours[t.color] ?? 0) + weight(t);
// The two most-used greys: the one with more contrast on the background is text, the other muted.
const contrastWith = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
};
const greys = ranked(textColours)
    .filter((c) => chroma(c) < 40)
    .slice(0, 2)
    .sort((a, b) => contrastWith(b, background) - contrastWith(a, background));
const overrides = { background, primary };
if (bgs[1])
    overrides.surface = bgs[1];
if (bgs[2])
    overrides.raised = bgs[2];
if (greys[0])
    overrides.text = greys[0];
if (greys[1])
    overrides['text-muted'] = greys[1];
const border = ranked(m.borders).find((c) => chroma(c) < 40);
if (border)
    overrides.border = border;
// Fonts and type levels from the measured text styles.
const fam = {};
for (const t of texts)
    if (!t.mono)
        fam[t.family] = (fam[t.family] ?? 0) + weight(t);
const sans = ranked(fam)[0] ?? 'Inter';
const mono = texts.find((t) => t.mono)?.family;
const styles = new Map();
for (const t of texts) {
    const k = `${t.mono}/${t.size}/${t.weight}/${t.upper}`;
    const s = styles.get(k) ?? { t, n: 0 };
    s.n += weight(t);
    styles.set(k, s);
}
const all = [...styles.values()].sort((a, b) => b.n - a.n);
const pick = (f) => all.find((s) => f(s.t))?.t;
const body = pick((t) => !t.mono && !t.upper && t.size >= 14 && t.size <= 17 && t.weight < 500);
const base = body?.size ?? 15;
const toLevel = (t) => ({
    fontFamily: t.family,
    fontSize: `${t.size}px`,
    fontWeight: t.weight,
    lineHeight: `${Math.round(t.lineHeight)}px`,
    letterSpacing: t.tracking
        ? `${(t.tracking / t.size).toFixed(3)}em`
        : t.upper
            ? `${tracking(t.size, true)}em`
            : '0em',
    ...(t.numeric || t.mono ? { fontFeature: '"tnum" 1' } : {}),
});
const measuredLevels = {
    'title-screen': pick((t) => !t.numeric && t.size >= 24),
    'title-card': pick((t) => !t.numeric && t.size >= 17 && t.size < 24 && t.weight >= 600),
    'display-stat': pick((t) => t.numeric && t.size >= 30),
    'number-lg': pick((t) => t.numeric && t.size >= 18 && t.size < 30),
    body,
    'body-strong': pick((t) => !t.mono && !t.upper && t.size >= 14 && t.size <= 17 && t.weight >= 500),
    meta: pick((t) => !t.mono && !t.upper && t.size >= 12 && t.size < base && t.weight < 500),
    'meta-number': pick((t) => t.mono && t.size <= 14),
    'label-chip': pick((t) => !t.upper && t.size >= 12 && t.size < base && t.weight >= 500),
    'label-caps': pick((t) => t.upper && t.size <= 13),
    caption: pick((t) => !t.upper && t.size <= 12 && t.weight < 500),
    'label-tab': pick((t) => t.size <= 11),
};
const radius = Number(ranked(m.radii)[0] ?? 16);
// The outermost surfaces start at the page padding; inner rows start further in.
const padding = Math.min(...Object.entries(m.lefts)
    .filter(([, n]) => n >= 2)
    .map(([l]) => Number(l)), 16);
const choices = choicesFrom(args, {
    name: typeof args.name === 'string' ? args.name : 'Extracted design',
    mood: `Measured from ${sources.join(', ')}; refine this line with the product and its mood.`,
    primary,
    modes: [mode],
    sans,
    mono,
    base,
    roundness: Math.round(radius / 1.25),
    page: padding >= 8 && padding <= 32 ? padding : 16,
    colorOverrides: { [mode]: overrides },
});
// Measured levels win; the rest come from the generated scale for the measured base size and fonts.
const { typeScale } = await import('./build-design.js');
const generated = typeScale({ ...choices, levels: undefined });
choices.levels = Object.fromEntries(Object.entries(generated).map(([k, l]) => [k, measuredLevels[k] ? toLevel(measuredLevels[k]) : l]));
const found = Object.entries(measuredLevels)
    .filter(([, t]) => t)
    .map(([k]) => k);
console.log(`measured ${texts.length} text elements on ${sources.length} page(s): ${mode} theme, primary ${primary}, ${sans}${mono ? ` + ${mono}` : ''}, body ${base}px, card radius ${radius}px, page padding ${padding}px`);
console.log(`  type levels measured: ${found.join(', ') || 'none'}; the rest generated`);
console.log(`  colours measured: ${Object.keys(overrides).join(', ')}; the rest generated from the primary`);
writeDesign(choices, args);
