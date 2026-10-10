---
name: stitch2-i18n
description: Design screens that work in every language the product ships — text marked with the project's message keys, checked in pseudo-languages, right to left and the real locales, side by side on the canvas. Use when a project has i18n in stitch2.config.json, when writing or changing screen text, when the user mentions languages, translations, RTL or a label that breaks in one language, or before handing over screens of a multilingual product.
---

# Screens in every language with stitch2

A screen is written once, in the source language, and every product string in it carries a **message key** from
the project's own translation files. stitch2 replaces the text from those files when the screen is opened in
another language, so one HTML file shows every locale, and the screen and the app share the same strings.
The checks then run each screen in the languages that break layouts: **pseudo** (every text about 40% longer,
accented, in brackets, so a cut end shows), **pseudo-rtl** (right to left) and the locales in the config.

## Setup

`stitch2.config.json` names the messages; paths are relative to it:

```json
"i18n": {
  "source": "en",
  "locales": ["en", "de", "ru", "ar"],
  "messages": { "en": "src/i18n/en.ts", "*": "src/i18n/locales/{locale}.ts" },
  "check": ["de", "ar"]
}
```

`messages` is one pattern (`"src/i18n/{locale}.json"`) or a map with `*` for the rest. JSON, or a JS/TS module:
its default export, else its first exported object. Nested objects become dotted keys (`nav.home`). Plurals
are objects keyed by CLDR category: `{ "one": "{count} set", "other": "{count} sets" }`. `check` lists the
locales `stitch2 check` runs besides the two pseudo-languages; pick the longest (German, Finnish, Russian) and
one right-to-left language, or `"all"`.

Use the app's own files. Never copy messages into the design folder: two copies drift.

## Marking text

```html
<span data-t="nav.home">Home</span>                              <!-- the element's text -->
<s2-header title="Settings" data-t-title="settings.title">       <!-- an attribute, before the component renders -->
<input placeholder="Search" data-t-placeholder="exercises.search" />
<p data-t="workout.sets" data-t-args="count=16">16 sets</p>     <!-- {count} filled in, plural form by count -->
<p translate="no">Dumbbell Bench Press</p>                      <!-- sample content: names, user input, numbers -->
<s2-row meta="5 exercises · Linear" data-t-meta="{plan.exercises|count=5} · {plan.linear}">
```

A value with braces is a **template**: each `{key}` or `{key|name=value;name=value}` becomes its message and
the rest stays as written. Use it for lines the app builds from several messages and data (a meta line, a
list of `label=url` links: `data-t-links="{site.features}=#features,{site.docs}=/docs"`); sample data inside
it stays literal. Without braces, `data-t-<attr>` on a comma list takes one key per item.

Dates and numbers are written by the locale too: `{@date|value=2026-10-04;weekday=short;day=numeric;month=short}`
("Sun, 4 Oct", "вс, 4 окт.") and `{@number|value=7920}` ("7,920", "7 920"); the options are `Intl.DateTimeFormat`'s and
`Intl.NumberFormat`'s, and dates are read and shown in UTC. Pair a number with the unit's message:
`{@number|value=82.5} {unit.kg}`.

- Keep the source text in the markup: the screen reads correctly without stitch2, and a missing key shows it.
- Key every string the product owns: labels, buttons, headings, empty states, hints, units, tab names, the
  placeholder and aria-label too. Sample data (an exercise name, a user's note, a number) gets `translate="no"`.
- `data-t` replaces the element's whole text, so put it on the innermost element holding just that string;
  an icon next to the label stays outside it.
- Components that draw their own labels (a tab bar's tab names) take them from `translate(key, fallback)` in
  `stitch2/elements` (or `window.__stitch2.t(key)` in plain JS), so the labels follow the language.
- Reuse the app's keys. Search the source messages for the text before inventing one (`stitch2 i18n --suggest`
  lists matches). A new string gets a key in the app's naming scheme, added to the **source** messages first and
  then to every locale; when you cannot write a good translation, add it to the source only and say so: the
  locale falls back to the source and the report lists it.

## Check

1. `stitch2 i18n [filter] --suggest`: per screen, keys the source lacks (errors: they show the screen's own text
   everywhere), keys each locale lacks, translations whose `{placeholders}` differ from the source, and text
   with no key. Fix until it reports no unknown keys and no unkeyed product text.
2. `stitch2 check <path> --shots`: runs the screen in the source, then in each check language. Issues that only
   appear in a language carry it ("pseudo: Text overflows…", "ar: …"); renders are saved as
   `--pseudo.png`, `--ar.png`. `--locales de,ar`, `all` or `none` overrides the config for one run.
3. Look at the screen side by side: the canvas's **Languages** page (sidebar, or "languages" in a screen's
   inspector) shows it once per language at the same size; the Language switch (`L`) shows the whole canvas in
   one language. Read the pseudo frames for cut or overlapping text and the right-to-left ones for anything
   that did not flip.

## Fixing text that does not fit

In this order, and never by shrinking the type below its level:

1. **Make room in the layout.** Let the text wrap where a second line is fine (headings, hints, cards); let a
   row stack its label above its value; give a button the full width; move a secondary action out of a crowded
   bar. Fixed widths and `whitespace-nowrap` on text are the usual cause.
2. **Use a shorter natural word** in that locale, the one a native speaker would use (a translator's choice,
   not an abbreviation the product does not use elsewhere). Change it in the locale's messages, which the app
   shares.
3. **Change the component** when one component fails in many languages (a tab label, a chip): fix it once in
   the component and the catalog, then re-check every screen.

Ellipsis is acceptable only for user content (a long exercise name), never for a label the product owns.

## Right to left

Use logical properties so layouts flip by themselves: `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`,
`text-start`, `rounded-s-*`. Icons that point (back, next, chevrons, progress) get `rtl:-scale-x-100`;
icons that show objects (a dumbbell, a clock) and numbers, charts and media controls do not flip.

## Hand over

Tell the user which languages you checked, what you changed to make each fit (layout, word, component), and
which locales still fall back to the source for new keys, by key.
