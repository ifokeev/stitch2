# How Stitch builds its screens

Observed through Stitch's MCP API, the HTML it generated for one project (ten screens, 341 text elements
measured with `stitch2 type`), and Google's public material: the DESIGN.md format (github.com/google-labs-code/
design.md, npm `@google/design.md`) and the stitch-skills repository (github.com/google-labs-code/stitch-skills).

## The pipeline

1. **A structured theme.** A Stitch design system is a typed object: headline, body and label fonts from a fixed
   list of about 65 Google Fonts; a seed colour with a Material dynamic-colour variant (TONAL_SPOT, FIDELITY,
   VIBRANT…) and optional overrides; a roundness level (2, 4, 8, 12 px or full); a spacing map; named typography
   levels (family, size, weight, line height, tracking); and a free-text DESIGN.md.
2. **DESIGN.md in Google's format.** An uploaded DESIGN.md comes back with YAML front matter: the Material colour
   roles generated from the seed, named type levels, radius and spacing scales, then the prose. Fonts outside its
   list are replaced silently (Geist Mono became Public Sans), and the prose is rewritten to match.
3. **A compiled Tailwind config per screen**, with the levels as `text-<level>` sizes bundling line height,
   tracking and weight, plus the colours, spacing and radii. Markup is written against those names, mixed with
   Tailwind's default steps (`text-sm`, `text-xs`), whose sizes carry fixed line heights.
4. **Prompts carry content only.** Google's own Stitch skills keep colours, fonts and radii out of prompts; their
   references are vocabulary lists. Stitch's visual judgement lives in its model and hidden prompt.

## What its screens tend to do

- About 70% of text at 10–13 px; one or two elements per screen at 20 px or more.
- Semibold carries hierarchy, including on 11–12 px labels; medium for names and values.
- Headings tightened (about −0.025em), small labels and capitals opened (+0.025 to +0.05em).
- A third text grey and opacity steps; the third grey often fails AA contrast.
- Pressed, hover and focus styles on nearly every control.
- Labels that make charts readable (axes, legends, figure captions) and distinct icons per item.

And what to watch for:

- Invented content: captions, statistics and features the prompt did not ask for.
- The accent on several elements per region; accent text on tinted backgrounds failing contrast.
- Monospace decimals with wide gaps ("80 . 7").
- Chrome that differs on every screen (tab bars, headers, icon buttons), because screens share nothing.
