/**
 * Builds a complete DESIGN.md (Google's DESIGN.md format) from a few choices or from measurements: colours from
 * one primary colour with Material 3 tonal palettes (text and status colours adjusted until they reach 4.5:1),
 * a 15-level type scale with tracking that follows size, radius and spacing scales, component tokens with
 * states, and prose sections that state the rules with the real values. Used by `stitch2 init` and
 * `stitch2 extract`.
 */
import { argbFromHex, Contrast, Hct, hexFromArgb, SchemeContent, SchemeExpressive, SchemeFidelity, SchemeMonochrome, SchemeNeutral, SchemeTonalSpot, SchemeVibrant, } from '@material/material-color-utilities';
export const ROLES = [
    'background',
    'surface',
    'raised',
    'border',
    'text',
    'text-muted',
    'text-faint',
    'primary',
    'primary-pressed',
    'on-primary',
    'primary-wash',
    'success',
    'warning',
    'danger',
];
const SCHEMES = {
    tonal_spot: SchemeTonalSpot,
    neutral: SchemeNeutral,
    fidelity: SchemeFidelity,
    vibrant: SchemeVibrant,
    expressive: SchemeExpressive,
    content: SchemeContent,
    monochrome: SchemeMonochrome,
};
const tone = (hex) => Hct.fromInt(argbFromHex(hex)).tone;
export const contrast = (a, b) => Contrast.ratioOfTones(tone(a), tone(b));
const withTone = (hex, t) => {
    const h = Hct.fromInt(argbFromHex(hex));
    return hexFromArgb(Hct.from(h.hue, h.chroma, Math.max(0, Math.min(100, t))).toInt());
};
/** Moves a colour's tone away from the background until it reaches the ratio (or the end of the range). */
function readable(hex, against, ratio, dark) {
    let t = tone(hex);
    let out = hex;
    while (against.some((b) => contrast(out, b) < ratio) && t >= 0 && t <= 100) {
        t += dark ? 1 : -1;
        out = withTone(hex, t);
    }
    return out;
}
export function palette(c, mode) {
    const dark = mode === 'dark';
    const Scheme = SCHEMES[c.scheme] ?? SchemeTonalSpot;
    const scheme = new Scheme(Hct.fromInt(argbFromHex(c.primary)), dark, 0);
    const n = (t) => hexFromArgb(scheme.neutralPalette.tone(t));
    const nv = (t) => hexFromArgb(scheme.neutralVariantPalette.tone(t));
    const surfaces = dark
        ? { background: n(6), surface: n(10), raised: n(17), border: nv(25), text: n(95) }
        : { background: n(98), surface: n(100), raised: n(94), border: nv(87), text: n(10) };
    const on = [surfaces.surface, surfaces.raised];
    // The accent is text too (active tabs, links): 4.5:1 on surfaces. Its label (on-primary) needs 4.5:1 on it:
    // when neither near-black nor white gets there, move the accent's tone further the same way.
    let primary = readable(c.primary, on, 4.5, dark);
    const ink = n(6);
    const white = '#ffffff';
    const label = (p) => (contrast(p, ink) >= contrast(p, white) ? ink : white);
    for (let t = tone(primary); contrast(label(primary), primary) < 4.5 && t > 0 && t < 100;) {
        t += label(primary) === ink ? 1 : -1;
        primary = withTone(primary, t);
    }
    const onPrimary = label(primary);
    const status = (hue) => {
        const base = hexFromArgb(Hct.from(hue, 60, dark ? 70 : 40).toInt());
        return readable(base, on, 4.5, dark);
    };
    const rgb = Hct.fromInt(argbFromHex(primary)).toInt();
    const wash = `rgba(${(rgb >> 16) & 255}, ${(rgb >> 8) & 255}, ${rgb & 255}, ${dark ? 0.14 : 0.12})`;
    const p = {
        ...surfaces,
        'text-muted': readable(nv(dark ? 75 : 40), on, 4.5, dark),
        'text-faint': nv(dark ? 55 : 60),
        primary,
        'primary-pressed': withTone(primary, tone(primary) - 8),
        'on-primary': onPrimary,
        'primary-wash': wash,
        success: status(150),
        warning: status(80),
        danger: status(25),
    };
    return { ...p, ...(c.colorOverrides?.[mode] ?? {}) };
}
const em = (v) => (v ? `${v}em` : '0em');
/** Tracking that follows size (fonts without optical sizes): tight titles, zero for reading sizes, open small text. */
export const tracking = (size, caps = false) => caps
    ? 0.06
    : size >= 40
        ? -0.04
        : size >= 26
            ? -0.03
            : size >= 18
                ? -0.02
                : size <= 11
                    ? 0.02
                    : size <= 12
                        ? 0.01
                        : 0;
export function typeScale(c) {
    if (c.levels)
        return c.levels;
    const k = c.base / 15;
    const s = (px) => Math.round(px * k);
    const lh = (px) => Math.round(px / 2) * 2;
    const level = (size, weight, line, opts = {}) => ({
        fontFamily: opts.mono && c.mono ? c.mono : c.sans,
        fontSize: `${size}px`,
        fontWeight: weight,
        lineHeight: `${line}px`,
        letterSpacing: em(tracking(size, opts.caps)),
        ...(opts.tnum || opts.mono ? { fontFeature: '"tnum" 1' } : {}),
    });
    const b = c.base;
    return {
        'display-number': level(s(48), 600, lh(s(52)), { tnum: true }),
        'display-stat': level(s(40), 600, lh(s(44)), { tnum: true }),
        'title-screen': level(s(28), 600, lh(s(34))),
        'title-sheet': level(s(22), 600, lh(s(28))),
        'number-lg': level(s(22), 500, lh(s(28)), { tnum: true }),
        'title-card': level(s(18), 600, lh(s(24))),
        body: level(b, 400, lh(b * 1.47)),
        'body-strong': level(b, 500, lh(b + 5)),
        'label-button': level(b, 600, lh(b + 5)),
        meta: level(s(13), 400, lh(s(18))),
        'meta-number': level(s(13), 400, lh(s(18)), { mono: true, tnum: true }),
        'label-chip': level(s(13), 500, lh(s(16))),
        'label-caps': level(s(12), 600, lh(s(16)), { caps: true }),
        caption: level(s(12), 400, lh(s(16))),
        'label-tab': level(s(11), 500, lh(s(14))),
    };
}
export function radii(r) {
    const px = (v) => `${Math.round(v)}px`;
    if (r >= 999)
        return {
            sm: '8px',
            input: '9999px',
            btn: '9999px',
            row: '16px',
            card: '20px',
            sheet: '24px',
            full: '9999px',
        };
    return {
        sm: px(r * 0.5),
        input: px(r * 0.75),
        btn: px(r * 0.875),
        row: px(r),
        card: px(r * 1.25),
        sheet: px(r * 1.5),
        full: '9999px',
    };
}
const yamlString = (v) => (/^[\w#.-]+$/.test(v) && !/^\d/.test(v) ? v : JSON.stringify(v));
export function buildDesignMd(c) {
    const pal = Object.fromEntries(c.modes.map((m) => [m, palette(c, m)]));
    const main = c.modes[0];
    const levels = typeScale(c);
    const rounded = radii(c.roundness);
    const spacing = {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
        page: `${c.page}px`,
    };
    const colors = { ...pal[main] };
    for (const m of c.modes.slice(1))
        for (const [k, v] of Object.entries(pal[m]))
            colors[`${m}-${k}`] = v;
    const ref = (g, k) => `"{${g}.${k}}"`;
    const components = {
        'button-primary': {
            backgroundColor: ref('colors', 'primary'),
            textColor: ref('colors', 'on-primary'),
            typography: ref('typography', 'label-button'),
            rounded: ref('rounded', 'btn'),
            height: '48px',
            padding: '20px',
        },
        'button-primary-pressed': { backgroundColor: ref('colors', 'primary-pressed') },
        'button-primary-disabled': {
            backgroundColor: ref('colors', 'raised'),
            textColor: ref('colors', 'text-faint'),
        },
        'button-secondary': {
            backgroundColor: ref('colors', 'raised'),
            textColor: ref('colors', 'text'),
            typography: ref('typography', 'label-button'),
            rounded: ref('rounded', 'btn'),
            height: '48px',
            padding: '20px',
        },
        'button-secondary-pressed': { backgroundColor: ref('colors', 'border') },
        chip: {
            backgroundColor: ref('colors', 'raised'),
            textColor: ref('colors', 'text-muted'),
            typography: ref('typography', 'label-chip'),
            rounded: ref('rounded', 'full'),
            height: '32px',
            padding: '12px',
        },
        'chip-selected': { backgroundColor: ref('colors', 'primary-wash'), textColor: ref('colors', 'primary') },
        segment: {
            backgroundColor: ref('colors', 'background'),
            textColor: ref('colors', 'text-muted'),
            typography: ref('typography', 'label-chip'),
            rounded: ref('rounded', 'sm'),
            height: '36px',
        },
        'segment-selected': { backgroundColor: ref('colors', 'raised'), textColor: ref('colors', 'text') },
        'tab-item': { textColor: ref('colors', 'text-muted'), typography: ref('typography', 'label-tab') },
        'tab-item-active': { textColor: ref('colors', 'primary') },
        input: {
            backgroundColor: ref('colors', 'raised'),
            textColor: ref('colors', 'text'),
            typography: ref('typography', 'body'),
            rounded: ref('rounded', 'input'),
            height: '48px',
            padding: '14px',
        },
        card: {
            backgroundColor: ref('colors', 'surface'),
            textColor: ref('colors', 'text'),
            rounded: ref('rounded', 'card'),
            padding: '16px',
        },
    };
    const y = [
        '---',
        'version: alpha',
        `name: ${yamlString(c.name)}`,
        `description: ${JSON.stringify(c.mood)}`,
        'colors:',
    ];
    for (const [k, v] of Object.entries(colors))
        y.push(`  ${k}: "${v}"`);
    y.push('typography:');
    for (const [k, l] of Object.entries(levels)) {
        y.push(`  ${k}:`, `    fontFamily: ${yamlString(l.fontFamily)}`, `    fontSize: ${l.fontSize}`, `    fontWeight: ${l.fontWeight}`, `    lineHeight: ${l.lineHeight}`, `    letterSpacing: ${l.letterSpacing}`);
        if (l.fontFeature)
            y.push(`    fontFeature: '${l.fontFeature}'`);
    }
    y.push('rounded:', ...Object.entries(rounded).map(([k, v]) => `  ${k}: ${v}`));
    y.push('spacing:', ...Object.entries(spacing).map(([k, v]) => `  "${k}": ${v}`));
    y.push('components:');
    for (const [k, props] of Object.entries(components)) {
        y.push(`  ${k}:`);
        for (const [p, v] of Object.entries(props))
            y.push(`    ${p}: ${v}`);
    }
    y.push('---', '');
    const p = pal[main];
    const ratio = (a, b) => contrast(a, b).toFixed(1);
    const lv = (k) => levels[k];
    const sizeOf = (k) => `${lv(k).fontSize.replace('px', '')}/${lv(k).lineHeight.replace('px', '')} ${lv(k).fontWeight}`;
    const prose = `# Design System: ${c.name}

## Overview
${c.mood} ${c.base <= 14 ? 'Dense' : c.base >= 16 ? 'Spacious' : 'Balanced'} density: one clear job per screen and the next action always obvious. ${c.roundness === 0 ? 'Square, precise corners.' : c.roundness >= 999 ? 'Pill-shaped controls and soft cards.' : c.roundness >= 16 ? 'Rounded but firm shapes.' : 'Gently rounded shapes.'} ${c.modes.length > 1 ? `${main === 'dark' ? 'Dark' : 'Light'} first, with a ${c.modes[1]} theme.` : `${main === 'dark' ? 'Dark' : 'Light'} theme.`}

## Colors
- **Surfaces:** background (${p.background}) for the screen, surface (${p.surface}) for cards and bars, raised (${p.raised}) for inputs, chips and pressed rows, border (${p.border}) for 1px dividers.
- **Text in three levels:** text (${p.text}, ${ratio(p.text, p.surface)}:1 on surface) for titles, values and anything the user acts on; text-muted (${p['text-muted']}, ${ratio(p['text-muted'], p.raised)}:1 on raised) for secondary lines and labels; text-faint (${p['text-faint']}) only for disabled controls and separators, never for information.
- **Primary** (${p.primary}): the single accent, for the main action, the active tab, selection and focus rings. At most one primary-filled element per screen region. Text on it is on-primary (${p['on-primary']}, ${ratio(p['on-primary'], p.primary)}:1); pressed is ${p['primary-pressed']}; primary-wash tints selected chips.
- **Status:** success (${p.success}), warning (${p.warning}), danger (${p.danger}), each at least 4.5:1 on surface and raised. They colour small text, icons and thin bars, never large fills.${c.modes.length > 1 ? `\n- The ${c.modes[1]} theme uses the \`${c.modes[1]}-*\` colours with the same roles.` : ''}

## Typography
${c.sans} everywhere${c.mono ? `, with ${c.mono} only for small standalone numbers (meta-number)` : ''}, at three weights: 400 for reading, 500 for names and values, 600 for titles, buttons and caps labels. The fifteen levels in the front matter are the only text styles; each fixes size, line height, weight and tracking together, so pick a level, never a size.

- **Hierarchy comes from weight and colour before size.** Most of a screen is ${sizeOf('meta').split('/')[0]}–${sizeOf('body').split('/')[0]}px; one or two elements per screen are large (the title, and the number the screen is about).
- **Tracking follows size:** titles tightened (−0.02em at 18–22px, −0.03em at 28px, −0.04em at 40px and up), reading sizes 0, small text opened slightly (caption +0.01em, tab labels +0.02em, caps labels +0.06em).
- **Numbers** use tabular figures. Large values use ${c.sans} with tabular figures so decimal points stay narrow${c.mono ? `; ${c.mono} is for small metadata that stands on its own, never mid-sentence` : ''}. Units sit next to their value at about half its size in text-muted.
- **Capitals** only in label-caps section labels, never in titles or buttons, and never for scripts without case (Chinese, Korean, Thai, Hindi, Arabic).
- **Languages:** no letter-spacing for Arabic, Thai, Hindi, Chinese or Korean; Thai and Hindi need at least 1.5 line height; labels survive German and Russian text about 30% longer than English.
- Body lines stay under 60 characters. No gradient text, no weights below 400 or above 600.

## Layout
- Mobile first at 390px wide (desktop frames 1280px). ${c.page}px side padding, 24px between sections, 12px between items inside a card, 16px card padding; the spacing scale is 4, 8, 12, 16, 24, 32, 48.
- Screen structure: a title row (title left, one or two icon buttons right), a vertical stack of sections, and a fixed bottom tab bar with safe-area padding.
- Desktop (1024px and up): a left sidebar replaces the tab bar; content up to 960px wide.
- Touch targets at least 44px. Nothing overlaps, nothing scrolls sideways except chip rows.

## Elevation & Depth
Depth comes from tonal layering: background recedes, surface cards step forward, raised controls sit on top, with 1px borders where two surfaces meet. No drop shadows on cards; a sheet or docked bar may cast one soft shadow.

## Shapes
${Object.entries(rounded)
        .filter(([k]) => k !== 'full')
        .map(([k, v]) => `${v} ${k === 'sm' ? 'small controls' : k === 'input' ? 'inputs' : k === 'btn' ? 'buttons' : k === 'row' ? 'list rows' : k === 'card' ? 'cards' : 'sheet tops'}`)
        .join(', ')}, and pills for chips. Never mix sharp and rounded corners in one view.

## Components
- **Buttons:** 48px tall, label-button. Primary: primary fill, on-primary text. Secondary: raised fill, text. Danger: transparent with danger text and a border.
- **Cards:** surface, card radius, 1px border, no shadow; hairline dividers inside, never cards in cards.
- **Chips:** 32px pills on raised, text-muted label-chip; a selected filter is primary-wash with primary text.
- **Segmented controls:** a background track with raised for the selected segment, text-muted turning text when selected.
- **Bottom tab bar:** surface with a top border, up to five items, each a ${c.icons} icon over a label-tab label; the active item is primary.
- **Inputs:** label above, raised fill, input radius, text-muted placeholder, a 2px primary focus ring.
- **Sheets:** bottom sheets with a grab handle and sheet-radius top corners.
- **Empty states:** one sentence of guidance and one action.
- Icons: ${c.icons}, one set everywhere, the same glyph for the same meaning on every screen.

### States (every interactive element shows them)
- **Pressed:** moves down 1px and darkens one step (primary → primary-pressed, raised → border); circular buttons scale to 0.95.
- **Hover (pointer devices only):** text-muted turns text; surfaces lighten one step.
- **Focus (keyboard):** 2px primary ring with a 2px offset.
- **Selected:** chips primary-wash with primary text; segments raised with text; the active tab primary.
- **Disabled:** text-faint on raised, no pressed or hover change, the reason shown nearby when not obvious.
- **Error:** danger border and one meta line in danger under the field, saying how to fix it.

## Do's and Don'ts
- Do build every screen from the shared components; adapt the content or extend the component rather than build a near-copy.
- Do use primary only for the single most important action in each region.
- Do pick text styles from the type levels; don't invent sizes between them.
- Don't use more than one accent colour, gradients behind text, glows or glassmorphism.
- Don't use placeholder names (John Doe, Acme) or fake round numbers in mock-ups.
- Don't use circular spinners: show skeletons the size of the content.

## Layout Guardrails
- Fixed bars never cover content: the scroll ends with enough bottom padding for the tab bar.
- Titles and metadata stay on one line; chips, segments and buttons never wrap their labels.
- Every element fits the frame: no clipping, no overlap, no horizontal page scroll (chip rows may scroll).
- Mock-ups show only what the app shows: no phone status bar, no step labels, no tip or promo cards, no helper text or features the screen's description does not ask for.
`;
    return `${y.join('\n')}${prose}`;
}
