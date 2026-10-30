# Guides worth reading

The skill works from principles.md and DESIGN.md; these are the sources behind them. Fetch the free ones when
a question goes deeper than the principles (a component's anatomy, a platform convention, an accessibility
rule). Paid books are listed for the humans on the team; an agent cannot read them, which is why their ideas
are restated in principles.md.

| Source | Free | Use it for |
|---|---|---|
| Material 3 (m3.material.io) | yes | Component anatomy and states, colour roles (stitch2 generates them as `md-*` tokens), type scale, motion durations |
| Apple Human Interface Guidelines (developer.apple.com/design/human-interface-guidelines) | yes | iOS conventions, sheets, tab bars, watchOS |
| Apple HIG, Layout (developer.apple.com/design/human-interface-guidelines/layout) and WWDC25 "Get to know the new design system" | yes | Aligning components to read hierarchy, layout guides, concentric shapes and optical balance |
| Material layout, keylines and spacing (m2.material.io/design/layout/spacing-methods.html) and Android content structure (developer.android.com/design/ui/mobile/guides/layout-and-content/content-structure) | yes | Margins and columns that content aligns to, keylines on an 8dp step |
| NN/g, 5 principles of visual design (nngroup.com/articles/principles-visual-design) | yes | Balance as equal weight, not mirror symmetry; Gestalt grouping |
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
| Material 3 interaction states (m3.material.io/foundations/interaction/states) | yes | The state layer percentages for hover, focus, pressed and dragged, and the disabled opacities |
| WCAG 2.2 Understanding: Use of Color, Non-text Contrast, Focus Appearance (w3.org/WAI/WCAG22/Understanding) | yes | Links told apart by more than colour (1.4.1), 3:1 for a focus ring and a control's edge (1.4.11), the focus ring's size (2.4.13) |
| MDN, the `hover` media feature (developer.mozilla.org/docs/Web/CSS/@media/hover) | yes | Drawing hover only for devices that can hover |
| GOV.UK Design System, Text input (design-system.service.gov.uk/components/text-input) | yes | Labels above fields, no placeholders, hints, widths that follow the answer, error wording, `inputmode` |
| Nielsen Norman Group, Placeholders in Form Fields Are Harmful and 10 Design Guidelines for Reporting Errors in Forms (nngroup.com/articles) | yes | Why a placeholder is not a label, floating labels, inline validation and when to run it |
| Material 3 accessibility, touch targets and Fluent 2, Layout (m3.material.io/foundations/designing/structure, fluent2.microsoft.design/layout) | yes | 48dp targets with 8dp between them; spacing and proximity: space says what is related; a 4px ramp |
| NN/g, Proximity Principle in Visual Design (nngroup.com/articles/gestalt-proximity) | yes | Near is related, apart is separate: the reason for a smaller gap inside a group |
| Red Hat design system, Focus indicators (ux.redhat.com/foundations/interactions/focus-indicators) and WCAG 2.2 Understanding: Target Size (Minimum), Focus Not Obscured (w3.org/WAI/WCAG22/Understanding) | yes | Padding on the container so the outer ring is not cut by overflow hidden, an inside ring where there is no padding; the spacing exception for small targets |
| WCAG 2.2 Understanding: Reflow, Text Spacing, Content on Hover or Focus, Focus Order, Pause Stop Hide (w3.org/WAI/WCAG22/Understanding) | yes | 320px without sideways scroll, the spacing a person may set, the three rules for a tooltip, the order of focus, the five-second rule for moving content |
| WAI-ARIA Authoring Practices: dialog (modal) and tooltip patterns (w3.org/WAI/ARIA/apg/patterns) | yes | Where focus goes in and back to, Escape, a name for a dialog; a tooltip is not focusable and goes with Escape |
| MDN, forced-colors (developer.mozilla.org/docs/Web/CSS/@media/forced-colors) | yes | box-shadow, text-shadow and background images are removed in Windows High Contrast, so a focus drawn by them is gone |
| Atlassian Design, Radius (atlassian.design/foundations/radius) and Radix Themes, Radius (radix-ui.com/themes/docs/theme/radius) | yes | One radius for buttons, inputs and selects, the next steps for containers, and a ring that follows the corner |
| WCAG 2.2 Understanding: Identify Input Purpose (1.3.5) and Non-text Contrast (1.4.11) (w3.org/WAI/WCAG22/Understanding) | yes | `autocomplete` purposes for fields about the person, and 3:1 for the edge that shows a field |
