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

No DESIGN.md yet, or a new look: build it first with the **stitch2-design-md** skill (`stitch2 init` or
`stitch2 extract`).

References, read before the first screen:

- [principles.md](references/principles.md): what makes a screen read well, and the review rubric.
- [typography.md](references/typography.md): type levels and how to combine them; most polish is here.
- [components.md](references/components.md): build from the shared components; the reuse ladder.
- [screens.md](references/screens.md): screen names, versions, statuses, the user's approval and notes, desktop.
- [guides.md](references/guides.md): the public sources behind the rules.

## Workflow

1. **Read** the brief, DESIGN.md, the references, the project skill and the component catalog (on the canvas,
   or its render under `<design>/renders/`). Run `stitch2 screens`: approved versions are the reference, notes
   are the user's feedback. A systemic change (a colour, a type level, a component) goes into DESIGN.md first,
   then `stitch2 lint` and `stitch2 tokens`.
2. **Inventory.** List every element the brief names, in order, with its real data. That list is the screen:
   add nothing (status bars, step labels, tips, helper text, extra buttons), drop nothing. Next to each element
   write the catalog component that shows it; adapt or extend components rather than inventing markup.
3. **Hierarchy before markup.** Name the one thing the user came for, the single primary action (the only
   accent-filled element in its region), and what is secondary. Give every text element a type level and a
   colour before writing markup.
4. **Build** the next version, `<screens>/<screen>/<device>-v<N>.html`, from the project's template (status
   `draft`; never edit an approved version). Assemble it from the components; plain markup only where none
   applies, with token classes, `.type-<level>` classes for text, the spacing scale, and the states DESIGN.md
   defines. Never add classes to a component to change how it looks.
5. **Check** `stitch2 check <path> --shots --strict`. Fix every error (overflow, wrapped labels, content under
   fixed bars, tap targets, contrast, cramped text) and every warning about type (`type-*`), hand-built
   components (`reuse`) and components that differ from the catalog (`consistency`).
6. **Look and critique.** View the render in `<design>/renders/` (crop the first screenful). Score it with the
   rubric in principles.md, fix what fails, repeat 5–6 at most three times.
7. **Hand over.** Set the version's status to `review`, point the user to it on the canvas, and report what
   changed, how you answered their notes, and any rubric item you could not satisfy. The user approves.

## Commands

`stitch2 <command>` from the project (through its package manager when stitch2 is a dev dependency):

| Command | What it does |
|---|---|
| `canvas` | The canvas at http://localhost:4400: screens and versions, DESIGN.md, the consistency report, approval and notes |
| `check [filter] [--shots] [--strict]` | Layout, type, reuse and consistency checks; `--shots` saves renders |
| `consistency [kind…]` | Every shared component cropped from every screen, next to the catalog's version |
| `type [filter] [--json]` | Every text style a screen uses and the type level it matches |
| `screens [name] [--status s] [--json]` | Every version with its status and the user's note |
| `tokens` | `tokens.css` (colours, `.type-*` classes) and `tailwind.tokens.js` from DESIGN.md |
| `lint` | Google's DESIGN.md linter |
| `localize [filter]` | Copies remote images a screen uses into its `assets/` folder |
| `init`, `extract` | Build DESIGN.md from choices, or measure it from an existing site (stitch2-design-md) |
| `sandbox create <dir> <brief.md>…`, `sandbox import <dir>` | Fresh-eyes versions from agents that see no other versions (stitch2-variants) |

## Alternatives and fresh eyes

When the user wants options or a new direction, or a design is stuck, do not iterate on the existing versions:
use the **stitch2-variants** skill. Fresh agents in sandboxes design from the brief without seeing the other
versions, and their screens come back as new versions to compare on the canvas. The same skill tests changes to
the skills or DESIGN.md.
