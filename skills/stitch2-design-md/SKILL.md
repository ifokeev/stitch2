---
name: stitch2-design-md
description: Create or update a project's DESIGN.md (Google's DESIGN.md format) with stitch2 — from a short interview (stitch2 init) or measured from an existing site or screens (stitch2 extract) — then refine it with the user. Use when a project has no design system yet, when the user wants a new look or a rebrand, or wants to capture an existing product's design.
---

# Building a DESIGN.md

DESIGN.md is the design system every other stitch2 skill and check reads: tokens (colours, type levels, radii,
spacing, components with states) in the YAML front matter, rules in the prose. Google Stitch builds one from a
theme or a website; stitch2 does the same with two commands, and you refine the result with the user.

## 1. Choose the starting point

- **From choices** (`stitch2 init`), when there is no product yet or the user wants a new look. Ask, in one
  message, only what you cannot infer: the product in one sentence and its mood; the brand colour (a hex, or a
  description you turn into one); dark, light or both; the font (default Inter; offer one or two that fit the
  mood); a monospace font for numbers, if any; corner style (square, gently rounded, rounded, pill); density
  (compact, balanced, spacious). Then run:
  `stitch2 init --name "…" --mood "…" --primary "#…" --modes dark,light --sans "…" [--mono "…"]
  --roundness 0|8|12|16|999 --base 14|15|16 --icons Lucide [--scheme tonal_spot|neutral|vibrant|…]`.
- **From an existing product** (`stitch2 extract <url or .html files…>`), when the user has a site, an app's web
  build or exported screens. Use several representative pages (a list, a detail, a form). It measures colours,
  fonts, text styles, radii and padding and generates what it cannot measure.

Both write `<design>/DESIGN.md` (`--out` elsewhere, `--force` to replace) and print the contrast of the pairs
that matter; when a brand colour had to move to reach 4.5:1, they say so. Tell the user about every adjustment.

## 2. Refine

The generated prose is correct but generic. Make it the product's:

1. **Overview**: the product, its users, the mood, in two or three sentences.
2. **Colors**: keep the role names (other skills and the components use them); give each a short brand name in
   the prose if the team has one. Extracted colours are guesses where the page was ambiguous: confirm text,
   surfaces and the primary with the user.
3. **Typography**: keep the levels; adjust sizes only together with the user and only on the scale.
4. **Components**: name the product's real components (its tab bar items, its core list row) and their states.
5. **Content & voice** and **Do's and Don'ts**: add the product's data style, naming and banned patterns.
6. Keep every rule checkable: values, not adjectives.

## 3. Validate and show

1. `stitch2 lint`: 0 errors. Warnings about disabled text contrast (WCAG exempts it), semi-transparent washes
   (the linter cannot measure them) and colours no component references are expected.
2. `stitch2 tokens`, then open the canvas: **DESIGN.md** in the sidebar draws the swatches, live type levels,
   radii and component tokens. Walk the user through it; change and repeat until they agree.
3. Then build the component catalog and the first screens with the stitch2 skill, and run stitch2-consistency.

## Updating an existing DESIGN.md

Edit the front matter and prose directly for small changes. For a rebrand, generate a new file with `--out`,
compare it with the current one (`npx @google/design.md diff old new`), and merge what the user approves;
every screen re-renders from the new tokens.
