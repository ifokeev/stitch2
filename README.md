# stitch2

A design lab for agent-built UI. Agents draft screens as plain HTML on your design system; stitch2 renders them,
checks them, keeps every version, and gives you a canvas to compare, approve and comment on them, and gives
agents skills that tell them how.

> stitch2 is inspired by [Google Stitch](https://stitch.withgoogle.com) and works with it, but it is an
> independent project, not affiliated with or endorsed by Google.

## What it does

- **Canvas** (`stitch2 canvas`): every screen and its versions on a pan-and-zoom board, a sidebar with search
  and status filters, your DESIGN.md drawn as tokens and rules, the component catalog, and an inspector to
  approve, archive or leave a note on a version. Live reload; copyable references to paste to an agent.
  Pick mode (`P`) highlights any element of a screen and copies a reference with its source line, such as
  `home mobile v1 (design/screens/home/mobile-v1.html:36) <gg-button> “Start Push”`; Shift-click collects
  several to copy at once or add to the version's note.
- **Checks** (`stitch2 check`): content past the frame edge, labels that wrap, content under fixed bars, fixed bars that overlap each other, tap
  targets (WCAG 2.2), text contrast, text that is not one of DESIGN.md's type levels, capitals without tracking,
  large numbers in monospace, components built by hand, components that differ between screens, and colours
  written as values instead of DESIGN.md tokens.
- **Consistency report** (`stitch2 consistency`): every shared component (tab bar, header, buttons, chips, …)
  cropped from every screen, next to the catalog's version, with what differs (sizes, fonts, icon set, icons).
- **Type audit** (`stitch2 type`): every text style a screen uses, and the level it matches.
- **Tokens** (`stitch2 tokens`): CSS variables, one `.type-<level>` class per type level (with per-language
  rules for scripts without capitals) and a Tailwind config, from DESIGN.md's front matter, plus Material 3
  colour roles from a seed colour. **Exports** write the same tokens for your app, so DESIGN.md drives the
  product as well as the screens: plain CSS variables, a Tailwind v4 theme (`@theme` plus `@utility type-*`), or
  W3C Design Tokens JSON for Style Dictionary and native platforms. Aliases keep your app's own variable names:

  ```json
  "exports": [
    { "format": "tailwind4", "path": "src/styles/design-tokens.css",
      "aliases": { "background": "surface", "primary": "primary", "border": "border" } },
    { "format": "dtcg", "path": "design/tokens.json" }
  ]
  ```
- **Versions and approval**: every file is a version of a screen for a device, with its status (draft, review,
  approved, archived) and your note in meta tags, so agents can read what you decided (`stitch2 screens`).
- **DESIGN.md builder**: `stitch2 init` writes a complete DESIGN.md from a few choices (brand colour, modes,
  fonts, roundness, density), with colours checked for contrast; `stitch2 extract` measures one from an existing
  site or screens.
- **Fresh-eyes variants** (`stitch2 sandbox`): a folder with your design system, components and skills but no
  screens, where a fresh agent designs from a brief without being anchored to the existing versions;
  `stitch2 sandbox import` brings the result back as the next version for review. Also the way to test a change
  to the skills on output only the rules produced.
- **Skills** for agents (`skills/`): `stitch2` (the design workflow, principles, typography, components,
  versions), `stitch2-design-md` (building the design system), `stitch2-variants` (fresh-eyes versions and
  testing skill changes), `stitch2-consistency` (verifying and fixing
  consistency) and, optional, `stitch2-import-from-google-stitch` (drafting screens in Google Stitch through its MCP server).

## Setup

1. Install it as a dev dependency (Node 24 or newer), then Chromium for Playwright, which renders the screens:

   ```bash
   pnpm add -D github:ifokeev/stitch2#release   # the latest release; #v0.1.0 to pin one
   npm install -D github:ifokeev/stitch2#release
   npx playwright install chromium
   ```
2. Create `DESIGN.md` in [Google's DESIGN.md format](https://github.com/google-labs-code/design.md) (tokens in
   the YAML front matter, rules in the prose): `stitch2 init --name "My app" --primary "#2F6FEB"` from a few
   choices, or `stitch2 extract https://my.app` from an existing product; then refine the prose.
   `stitch2 lint` validates it.
3. Add `stitch2.config.json` at the project root (all keys optional):

   ```json
   {
     "name": "my app design lab",
     "designDir": "design",
     "screenDirs": ["screens"],
     "catalogDir": "screens/components",
     "prefix": "ma",
     "order": ["home", "settings"]
   }
   ```

   The schema is [config.schema.json](config.schema.json). `prefix` names your meta tags (`ma-status`), your
   components and their marker (`<ma-button>`, `data-ma`) and your CSS variables (`--ma-*`).
4. Run `stitch2 tokens`, write your components as light-DOM custom elements that mark themselves
   `data-<prefix>="<name>"`, show them in a catalog screen, and a screen template that loads Tailwind, your
   tokens, your components and your icons.
5. Copy or link the skills from `skills/` into your agent's skills folder (for example `.agents/skills/`), and
   add a short project skill with your brand, component list, screen names and demo data.

## Your app's components on the canvas

Screens can use the app's own components, so a screen shows exactly what the app renders and the two cannot
drift. `stitch2/elements` turns components of any framework into the `<prefix>-<name>` elements screens use:

```tsx
// design/elements.tsx
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defineElements } from 'stitch2/elements'
import { Button, Card, Row } from '../src/ui'

defineElements({ button: Button, card: Card, row: Row }, {
  prefix: 'ex',
  render: (C, props) => renderToStaticMarkup(createElement(C, props)),
})
```

`stitch2 elements design/elements.tsx` bundles it into `design/components/<prefix>.elements.js`. A screen loads
that bundle, the Tailwind v4 browser build and the theme from a `tailwind4` export, and writes
`<ex-row name="Morning run" chevron></ex-row>`:

```html
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<link rel="stylesheet" type="text/tailwindcss" href="/tokens.tailwind.css" />
<script src="/components/ex.elements.js" defer></script>
```

Attributes become props (kebab-case to camelCase, an empty attribute is `true`), the element's content becomes
`children`, and each element marks its root `data-<prefix>` so the checks and the consistency report find it.
The stitch2 server inlines `text/tailwindcss` links, which the browser build cannot load itself. Tested with
React; any framework with a string renderer fits `render` (Preact, Solid, and Vue's asynchronous one).

## Is the app still the design?

`stitch2 compare` opens every approved version next to its live page in the app, at the same width, and reports
what differs in structure: shared components the design has and the app lacks (or the other way round), their
order, and how the measured ones look. Mock-ups and the app hold different data, so the screenshots are shown side
by side in `design/compare/index.html` (the canvas links it) rather than diffed. Configure it in the config:

```json
"app": {
  "url": "http://localhost:3000",
  "signIn": "design/app/sign-in.mjs",
  "routes": { "home": "/", "exercise-detail": { "path": "/exercises", "prepare": "design/app/open-first.mjs" } }
}
```

A route with `"signedOut": true` (a sign-in page, which would redirect a signed-in visitor) is opened in a
separate browser context that never signed in.

`signIn` and `prepare` are modules whose default export gets `{ page, url }` (a Playwright page): sign in once, or
put a page into the state the design shows (open a sheet, start a workout). The app's components must carry the
`data-<prefix>` markers, which they do when the screens use them too (see above). A `prepare` that throws becomes
an error on that version and the run goes on. When it opens a modal, wait for something inside it (a marked
component): dialog roots are often zero-sized wrappers, which Playwright reports as hidden.

## Commands

| Command | What it does |
|---|---|
| `stitch2 init --name N --primary #hex [options]` | Writes a complete DESIGN.md from a few choices |
| `stitch2 extract <url or file…>` | Writes a DESIGN.md measured from an existing site or screens |
| `stitch2 canvas` | The canvas at http://localhost:4400 (`PORT` and `HOST` to change) |
| `stitch2 check [filter] [--shots] [--strict]` | All checks; `--shots` saves renders to `<design>/renders/` |
| `stitch2 consistency [kind…]` | The consistency report, `<design>/consistency/index.html` |
| `stitch2 type [filter] [--json]` | The type audit |
| `stitch2 screens [name] [--status s] [--json]` | Versions, statuses and notes |
| `stitch2 tokens` | Tokens from DESIGN.md |
| `stitch2 compare [screen…]` | The live app against the approved screens (`app` in the config) |
| `stitch2 elements <entry>` | Bundle your components (`stitch2/elements`) for the screens |
| `stitch2 lint` | Google's DESIGN.md linter |
| `stitch2 localize [filter]` | Copies a screen's remote images into its `assets/` folder |
| `stitch2 sandbox create <dir> <brief.md>… [--context <screen>…]` | A fresh-eyes folder for an agent that sees no other versions |
| `stitch2 sandbox import <dir> [--label …]` | Brings its screens back as new versions, status review |

## Development

```bash
git clone https://github.com/ifokeev/stitch2 && cd stitch2
pnpm install
node src/cli.ts <command>    # runs the TypeScript sources directly (Node 24 strips the types)
pnpm typecheck
pnpm build                   # compiles to dist/, which the installed package runs
```

Releases: bump `version` in package.json, commit, then `pnpm release`. It builds, packs exactly what npm would
publish, commits that to the `release` branch (built files only, so installs need no build step) and tags it
`v<version>`. `main` holds sources only; `dist/` is ignored.

Point it at a project with `STITCH2_CONFIG=/path/to/stitch2.config.json`, or run it from inside the project.

## Licence

MIT, see [LICENSE](LICENSE). It builds on Apache-2.0 projects: Playwright, Google's material-color-utilities and
`@google/design.md`.
