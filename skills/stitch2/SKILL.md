---
name: stitch2
description: Design app screens as HTML with the stitch2 design lab — a canvas, layout and type checks, shared components, screen versions and the user's approval — on a project's DESIGN.md. Use when drafting or redesigning a screen or flow, fixing what the checks flag, comparing variants, or running a blind design trial.
---

# Designing screens with stitch2

stitch2 is a design lab for agents. A screen is one HTML file (Tailwind from a CDN, the project's generated
tokens, an icon set) at phone or desktop width. stitch2 renders it in Chromium, checks it, and shows every screen
version on a canvas where the user approves, archives or comments on each one. The design system is the
project's `DESIGN.md` in Google's DESIGN.md format: tokens in the YAML front matter, rules in the prose.

The project tunes all of this in `stitch2.config.json` (folders, the prefix of its meta tags, components and
CSS variables, screen order) and in a **project skill** with its specifics: brand, components, screen names,
data. Read the project skill first when there is one; it wins over this one where they differ.

A project without stitch2 yet: ask the user for the product name, brand colour and modes, then run
`stitch2 setup --name "…" --primary "#…" --modes …` (config, DESIGN.md and tokens, template, catalog, starter
components, and these skills linked). No DESIGN.md yet, or a new look: build it first with the
**stitch2-design-md** skill (`stitch2 init` or `stitch2 extract`).

References, read before the first screen:

- [principles.md](references/principles.md): what makes a screen read well, and the review rubric.
- [typography.md](references/typography.md): type levels and how to combine them; most polish is here.
- [components.md](references/components.md): build from the shared components; the reuse ladder.
- [screens.md](references/screens.md): screen names, versions and their variants (mobile, desktop), the widths
  each variant covers, statuses, the user's approval and notes.
- [google.md](references/google.md): Google's guidance (Material, Android, web.dev) as rules with numbers.
- [motion.md](references/motion.md): motion tokens, what may move and how, reduced motion.
- [guides.md](references/guides.md): the public sources behind the rules.

## Workflow

1. **Read** the brief, DESIGN.md, the references, the project skill and the component catalog (on the canvas,
   or its render under `<design>/renders/`). Run `stitch2 screens`: approved versions are the reference, notes
   are the user's feedback. A systemic change (a colour, a type level, a component) goes into DESIGN.md first,
   then `stitch2 lint` and `stitch2 tokens`.
2. **Inventory.** List every element the brief names, in order, with its real data. That list is the screen:
   add nothing (status bars, step labels, tips, helper text, extra buttons), drop nothing. Next to each element
   write the catalog component that shows it; adapt or extend components rather than inventing markup.
   Then list the page's **states**. A page that shows data gets an empty screen and a loading screen, designed
   with its main screen in the same version; a page that loads or saves data that can fail also gets an error
   state. Build them with the main screen; they are part of the page (screens.md, Empty, loading and error).
3. **Hierarchy before markup.** Name the one thing the user came for, the single primary action (the only
   accent-filled element in its region), and what is secondary. Give every text element a type level and a
   colour before writing markup.
4. **Build** the next version, `<screens>/<screen>/<device>-v<N>.html`, or a missing variant of an existing
   version (another device, the same N), from the project's template (status `draft`; never edit an approved
   variant). Assemble it from the components; plain markup only where none
   applies, with token classes, `.type-<level>` classes for text, the spacing scale, and the states DESIGN.md
   defines. When the config has `i18n`, mark every product string with its message key (`data-t`, see
   **stitch2-i18n**). Write the text as **stitch2-copy** says (the reader's outcome, plain words, the product's terms),
   and translate it with **stitch2-translate**. Never add classes to a component to change how it looks, and never write a colour value (hex,
   `rgb()`, `hsl()`): only DESIGN.md's colours, as token classes or `var(--<prefix>-<name>)`.
5. **Check** `stitch2 check <path> --shots --strict`. Fix every error (overflow, wrapped labels, content under
   fixed bars, fixed bars overlapping each other, tap targets, contrast, cramped text), a hand-built copy of a
   catalog component (`reuse`: use the component or extend it, never rebuild it), and every warning about type
   (`type-*`), components that differ from the catalog (`consistency`) and colour values (`color`).
   Text running into other text (`text-overlap`) or out of its card (`overflow`) is an error; a short label cut
   short with an ellipsis (`truncated`) is a warning to fix with room, not a smaller size. Google's rules are
   warnings too (`text-small`, `edge-margin`, `measure`, `tap-spacing`, `placeholder-label`, `unnamed-control`,
   `nav-destinations`, `focus-visible`; see google.md): fix them, or say in the hand-over why the screen breaks one. When DESIGN.md has a
   light and a dark theme, every screen is checked in both: an issue marked with a theme
   ("light theme: Low contrast…") is fixed in DESIGN.md's colours for that theme when it shows on many
   screens, or in the screen when it is one element. Look at both renders (`--light.png`). With `i18n`, check
   also runs the screen in the pseudo-languages and the config's locales; fix what they flag as the
   **stitch2-i18n** skill says.
   An issue tagged with a width ("at 1024px: …") breaks at an edge of the windows the variant covers: fix it with a
   responsive rule in the screen, or a new variant when the layout's structure has to change (screens.md, Widths).
   Widths include the breakpoints inside the range; `narrow-layout` is a phone column left in a wide window.
   Overlap checks compare the drawn fragments of wrapped inline controls, not the empty corners of their
   bounding boxes. For fixed bars, the browser's paint order decides coverage: a menu painted in front of a
   header is not hidden by it. Native modal dialogs and ARIA modals limit coverage and control comparisons
   to the active dialog. Transparent hints, fully clipped accessible inputs and content in zero-sized
   overflow-clipped wrappers are not drawn controls. Positioned descendants whose containing block lies
   outside that wrapper, and top-layer dialogs, remain checked because the wrapper does not clip them.
   An empty, transparent stretched row/card action may sit under a secondary link; painted controls or
   partially colliding neighbours still fail. Do not silence an overlap by hiding content or removing its
   accessible label: inspect the visible state and fix actual collisions in the shared component.
   Inline links within a prose sentence may wrap and receive WCAG's inline-target exception, including
   sentences inside list items; standalone links do not. Titles in vertical contents/menu lists may wrap,
   unlike horizontal navigation labels. An in-page disclosure (`aria-expanded`, without `aria-haspopup`)
   may have a multiline heading when its height and padding fit the complete text. A text input's clear,
   reveal or list-toggle button may overlap only padding reserved for it, never the editable text area.
   Cached checks are invalidated when shared components, the catalog or the checker change. A filtered
   rerun refreshes only those screens; it must not make unrelated screens' older checks appear current.
   Motion warnings: `motion-token` (a transition length DESIGN.md doesn't name) and `reduced-motion` (something
   still moves when the person asked for less); see motion.md. On the catalog, `state-*` warnings come from the
   States sheet (components.md, States).
6. **Look and critique.** View the render in `<design>/renders/` (crop the first screenful). Score it with the
   rubric in principles.md, fix what fails, repeat 5–6 at most three times.
7. **Hand over.** Set the version's status to `review`, point the user to it on the canvas, and report what
   changed, how you answered their notes, and any rubric item you could not satisfy. The page's empty and loading
   screens go to review with it; for a page without them (a form, a static page), say why. The user approves; only then
   does it go into the app (the approved version is the one current version: see screens.md).

## Commands

`stitch2 <command>` from the project (through its package manager when stitch2 is a dev dependency):

| Command | What it does |
|---|---|
| `setup [--name N --primary #hex] [options]` | Sets a project up in one step; keeps every file that exists |
| `canvas` | The canvas at http://localhost:4400: screens and versions, DESIGN.md, the consistency report, approval and notes |
| `check [filter] [--shots] [--strict] [--locales l,…]` | Layout, type, reuse and consistency checks, in every theme and check language, and at both ends of each variant's widths; `--shots` saves renders |
| `i18n [filter] [--locale l] [--suggest]` | Message keys screens use that the source or a locale lacks, and text with no key (stitch2-i18n) |
| `consistency [kind…]` | Every shared component cropped from every screen, next to the catalog's version |
| `type [filter] [--json]` | Every text style a screen uses and the type level it matches |
| `screens [name] [--status s] [--json] [--strict]` | Every version with its status and the user's note, and anything that makes the current version unclear |
| `approve <path or filter…>` | Approves variants for the user (only on their word); every earlier version of the screen on that device is archived |
| `compare [screen…]` | The live app against the approved versions: missing or extra components, order, looks; a side-by-side report |
| `elements <entry>` | Bundles the app's components, turned into elements with `stitch2/elements`, for the screens |
| `tokens` | `tokens.css` (colours, `.type-*` classes) and `tailwind.tokens.js` from DESIGN.md |
| `lint` | Google's DESIGN.md linter |
| `localize [filter]` | Copies remote images a screen uses into its `assets/` folder |
| `init`, `extract` | Build DESIGN.md from choices, or measure it from an existing site (stitch2-design-md) |
| `sandbox create <dir> <brief.md>…`, `sandbox import <dir>` | Fresh-eyes versions from agents that see no other versions (stitch2-alternatives) |

## Alternatives and fresh eyes

When the user wants options or a new direction, or a design is stuck, do not iterate on the existing versions:
use the **stitch2-alternatives** skill. Fresh agents in sandboxes design from the brief without seeing the other
versions, and their screens come back as new versions to compare on the canvas. The same skill tests changes to
the skills or DESIGN.md.
