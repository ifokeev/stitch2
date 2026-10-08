import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { config, ROOT } from './config.js';
export { ROOT };
/** A lab meta tag name: <prefix>-screen, <prefix>-status… (the prefix comes from the config). */
export const tag = (name) => `${config.prefix}-${name}`;
export const STATUSES = ['draft', 'review', 'approved', 'archived'];
function* htmlFiles(dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (e.name.startsWith('_') || e.name.startsWith('.') || e.name === 'assets')
            continue;
        const p = join(dir, e.name);
        if (e.isDirectory())
            yield* htmlFiles(p);
        else if (e.name.endsWith('.html'))
            yield p;
    }
}
export const meta = (html, name) => new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i').exec(html)?.[1];
export function listScreens() {
    const out = [];
    const under = (path, dir) => path.startsWith(`${dir}/`);
    for (const dir of config.screenDirs) {
        for (const file of htmlFiles(join(ROOT, dir))) {
            const html = readFileSync(file, 'utf8');
            const path = relative(ROOT, file);
            const name = path
                .split('/')
                .pop()
                .replace(/\.html$/, '');
            const group = relative(ROOT, join(file, '..'));
            const width = Number(meta(html, tag('frame-width')) ?? 390);
            const archive = config.archiveDirs.find((d) => under(path, d));
            const source = (meta(html, tag('source')) ??
                (under(path, config.stitchDir) ? 'stitch' : archive ? 'trial' : 'lab'));
            // design/screens/<screen>/<device>-v<N>.html, or older files named after the screen.
            const versioned = /^(mobile|desktop)-v(\d+)$/.exec(name);
            out.push({
                path,
                group,
                name,
                title: /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '',
                width,
                mtime: statSync(file).mtimeMs,
                kind: under(path, config.catalogDir) ? 'components' : 'screen',
                screen: meta(html, tag('screen')) ?? (versioned ? group.split('/').pop() : name),
                device: (meta(html, tag('device')) ??
                    (versioned?.[1] || (width >= 768 ? 'desktop' : 'mobile'))),
                source,
                version: meta(html, tag('version')) ??
                    (versioned
                        ? `v${versioned[2]}`
                        : source === 'stitch'
                            ? 'Stitch'
                            : (archive?.split('/').pop() ?? 'v1')),
                status: (meta(html, tag('status')) ?? (archive ? 'archived' : 'review')),
                note: meta(html, tag('note'))?.replaceAll('&quot;', '"').replaceAll('&amp;', '&') ?? '',
            });
        }
    }
    return out;
}
/** Sets (or removes, with undefined) <prefix>-* meta tags in a screen file, keeping the rest of it untouched. */
export function writeMeta(path, values) {
    const file = join(ROOT, path);
    let html = readFileSync(file, 'utf8');
    for (const [name, value] of Object.entries(values)) {
        const re = new RegExp(`[ \\t]*<meta\\s+name="${name}"\\s+content="[^"]*"\\s*/?>\\n?`, 'i');
        html = html.replace(re, '');
        if (value === undefined || value === '')
            continue;
        const tag = `<meta name="${name}" content="${value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('\n', ' ')}" />\n`;
        html = /<head[^>]*>\n?/i.test(html)
            ? html.replace(/<head[^>]*>\n?/i, (m) => `${m.endsWith('\n') ? m : `${m}\n`}${tag}`)
            : tag + html;
    }
    writeFileSync(file, html);
}
