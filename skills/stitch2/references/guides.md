# Guides worth reading

The skill works from principles.md and DESIGN.md; these are the sources behind them. Fetch the free ones when
a question goes deeper than the principles (a component's anatomy, a platform convention, an accessibility
rule). Paid books are listed for the humans on the team; an agent cannot read them, which is why their ideas
are restated in principles.md.

| Source | Free | Use it for |
|---|---|---|
| Material 3 (m3.material.io) | yes | Component anatomy and states, colour roles (stitch2 generates them as `md-*` tokens), type scale, motion durations |
| Apple Human Interface Guidelines (developer.apple.com/design/human-interface-guidelines) | yes | iOS conventions, sheets, tab bars, watchOS |
| WCAG 2.2 (w3.org/TR/WCAG22) | yes | Contrast (1.4.3), target size (2.5.8), focus, motion |
| Laws of UX (lawsofux.com) | yes | Fitts, Hick, Jakob, proximity and similarity, with short explanations |
| Refactoring UI, Adam Wathan & Steve Schoger (refactoringui.com) | no | The most practical book on hierarchy, spacing, colour and depth; principles.md restates its main ideas |
| Google's material-color-utilities (github.com/material-foundation/material-color-utilities) | yes | Generating tonal palettes and roles from a seed (`tokens` uses it) |
| DESIGN.md format (github.com/google-labs-code/design.md, npm `@google/design.md`) | yes | The file format of DESIGN.md (the one Stitch reads and writes); `stitch2 lint` runs its linter, and `design.md export css-tailwind` emits Tailwind v4 `@theme` for the app |
| Stitch skills (github.com/google-labs-code/stitch-skills) | yes | How Google prompts Stitch: content and structure in prompts, all style in the design system |
| Vercel Geist typography (vercel.com/geist/typography) | yes | The type scale made for Geist by its authors: sizes, line heights and the tracking that suits it (and fonts like it) |
| Apple HIG, Typography (developer.apple.com/design/human-interface-guidelines/typography) | yes | iOS Dynamic Type sizes, the SF Pro tracking table, minimum sizes (11pt), watchOS sizes |
| Material 3 type scale (m3.material.io/styles/typography/type-scale-tokens) | yes | Role names (display, headline, title, body, label) and how labels open up at small sizes |
| Google's guidance, restated as rules ([google.md](google.md)) | — | Window size classes, canonical layouts, Material's type, shape, state and motion numbers, 48 px targets, line length, forms |
| Android app quality guidelines (developer.android.com/docs/quality-guidelines) | yes | What Google Play calls a quality app: 48dp targets, contrast, line length 45–75, light and dark, adaptive layouts |
| web.dev Learn Design and Learn Forms (web.dev/learn/design, web.dev/learn/forms) | yes | Responsive layout, typography, navigation patterns, interaction (pointer, hover), accessibility, forms |
| Lighthouse audits (developer.chrome.com/docs/lighthouse) | yes | The exact rules behind tap target spacing and legible font sizes |
