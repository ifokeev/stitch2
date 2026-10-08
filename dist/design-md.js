/**
 * Reads design/DESIGN.md's YAML front matter (the DESIGN.md format: colors, typography, rounded, spacing,
 * components) and resolves {path.to.token} references.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ROOT } from './screens.js';
export function readDesign(file = join(ROOT, 'DESIGN.md')) {
    const text = readFileSync(file, 'utf8');
    const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
    if (!front)
        throw new Error(`${file} has no YAML front matter`);
    const raw = parse(front);
    const resolve = (value, depth = 0) => {
        if (typeof value !== 'string')
            return value;
        const ref = /^\{([\w.-]+)\}$/.exec(value)?.[1];
        if (!ref || depth > 10)
            return value;
        const target = ref.split('.').reduce((o, k) => o?.[k], raw);
        return resolve(target, depth + 1);
    };
    const colors = Object.fromEntries(Object.entries(raw.colors ?? {}).map(([k, v]) => [k, String(resolve(v))]));
    return {
        name: raw.name ?? '',
        colors,
        typography: raw.typography ?? {},
        rounded: raw.rounded ?? {},
        spacing: raw.spacing ?? {},
        components: raw.components ?? {},
    };
}
export function typeLevels(design = readDesign()) {
    return Object.entries(design.typography).map(([name, t]) => {
        const size = Number.parseFloat(String(t.fontSize));
        const lh = String(t.lineHeight);
        return {
            name,
            mono: /mono/i.test(t.fontFamily ?? ''),
            size,
            weight: Number(t.fontWeight ?? 400),
            lineHeight: lh.endsWith('px') ? Number.parseFloat(lh) : Number.parseFloat(lh) * size,
            tracking: t.letterSpacing?.endsWith('em')
                ? Number.parseFloat(t.letterSpacing) * size
                : Number.parseFloat(t.letterSpacing ?? '0') || 0,
        };
    });
}
