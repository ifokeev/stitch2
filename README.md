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
- **Checks** (`stitch2 check`): content past the frame edge, labels that wrap, content under fixed bars, tap
  targets (WCAG 2.2), text contrast, text that is not one of DESIGN.md's type levels, capitals without tracking,
  large numbers in monospace, components built by hand, and components that differ between screens.
- **Consistency report** (`stitch2 consistency`): every shared component (tab bar, header, buttons, chips, …)
  cropped from every screen, next to the catalog's version, with what differs (sizes, fonts, icon set, icons).
- **Type audit** (`stitch2 type`): every text style a screen uses, and the level it matches.
- **Tokens** (`stitch2 tokens`): CSS variables, one `.type-<level>` class per type level (with per-language
  rules for scripts without capitals) and a Tailwind config, from DESIGN.md's front matter, plus Material 3
  colour roles from a seed colour.
- **Versions and approval**: every file is a version of a screen for a device, with its status (draft, review,
  approved, archived) and your note in meta tags, so agents can read what you decided (`stitch2 screens`).
- **Blind trials** (`stitch2 sandbox`): an isolated folder with your design system and skills but no screens,
  to compare approaches without leaking context.
- **Skills** for agents (`skills/`): `stitch2` (the design workflow, principles, typography, components,
  versions), `stitch2-consistency` (verifying and fixing consistency) and `stitch2-google-stitch` (drafting in
  Google Stitch through its MCP server).

## Setup

1. Install it as a dev dependency (Node 24 or newer) and Chromium for Playwright: `npx playwright install chromium`.
2. Write `DESIGN.md` in [Google's DESIGN.md format](https://github.com/google-labs-code/design.md): tokens in the
   YAML front matter (colours with a `primary`, typography levels, rounded, spacing, components), rules in the
   prose. `stitch2 lint` validates it.
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

## Commands

| Command | What it does |
|---|---|
| `stitch2 canvas` | The canvas at http://127.0.0.1:4400 (`PORT` to change) |
| `stitch2 check [filter] [--shots] [--strict]` | All checks; `--shots` saves renders to `<design>/renders/` |
| `stitch2 consistency [kind…]` | The consistency report, `<design>/consistency/index.html` |
| `stitch2 type [filter] [--json]` | The type audit |
| `stitch2 screens [name] [--status s] [--json]` | Versions, statuses and notes |
| `stitch2 tokens` | Tokens from DESIGN.md |
| `stitch2 lint` | Google's DESIGN.md linter |
| `stitch2 localize [filter]` | Copies a screen's remote images into its `assets/` folder |
| `stitch2 sandbox <dir> <brief.md>…` | A blind-trial folder |

## Status

Built and used inside [gymgym](https://github.com/ifokeev/gymgym), where it is tuned on a real app. Not yet
published to npm: it runs its TypeScript sources directly with Node's type stripping, which Node does not apply
inside `node_modules`, so a build step comes first.

## Licence

MIT, see [LICENSE](LICENSE). It builds on Apache-2.0 projects: Playwright, Google's material-color-utilities and
`@google/design.md`.
