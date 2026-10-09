# stitch2: notes for coding agents

stitch2 is a design lab for agent-built UI: a canvas, layout and type checks, component consistency, screen
versions and approval, on Google's DESIGN.md format. This file is for working **on** stitch2; projects that **use**
it get the skills in `skills/` (`stitch2 setup` links them).

## Layout

- `src/cli.ts` dispatches commands to one module each: `setup.ts`, `init.ts`, `extract.ts`, `serve.ts` (canvas),
  `check.ts` (with `audit.ts`, `consistency.ts`, `typecheck.ts`, `colours.ts`), `report.ts`, `type.ts`, `tokens.ts`
  (with `exports.ts`), `compare.ts`, `build-elements.ts`, `list.ts`, `assets.ts`, `sandbox.ts`.
- `src/config.ts` reads `stitch2.config.json`; `src/screens.ts` lists screen versions from their meta tags.
- `src/canvas.html` is the canvas page (no build step).
- `skills/` are the agent skills that ship with the package; `config.schema.json` documents the config.
- `test/` is the smoke test; `scripts/release.mjs` publishes a build to the `release` branch.

## Rules

- **TypeScript run by Node** (24+, type stripping): erasable syntax only (no enums, namespaces or parameter
  properties), explicit `.ts` imports. Code that runs inside a page through Playwright (`audit`, `collectComponents`)
  must be self-contained: Playwright sends the function's source, so it cannot use imports or outer variables.
- **Checks and skills change together.** A new or changed check gets its rule, what it means and how to fix it in the
  skill that tells agents to run it (`skills/stitch2` or `skills/stitch2-consistency`); skill text never promises
  something the code does not do.
- **Project-agnostic.** No product names, brand colours or project paths in code, skills or examples; projects add
  those in their own skill. Defaults come from `stitch2 init`'s DESIGN.md.
- **Google Stitch stays optional** (`skills/stitch2-import-from-google-stitch`). stitch2 is not affiliated with Google;
  keep the README's statement. Never commit an API key.
- **Dependencies** are few and MIT-compatible (MIT, ISC, BSD, Apache-2.0). Ask before adding one.
- **Commits** follow Conventional Commits, with a body that explains why.

## Checks

```bash
pnpm install
pnpm typecheck
pnpm test                       # needs Chromium: npx playwright install chromium
node src/cli.ts <command>       # run from the sources in any project (or STITCH2_CONFIG=/path/to/stitch2.config.json)
```

Try a change to a check, the canvas or the skills on a real project before releasing: run it from the sources there
and read the screens, not only the numbers.

## Releases

Bump `version` in package.json, commit, then `pnpm release`: it builds, packs what npm would publish, commits that to
the `release` branch (built files only, so installs need no build step) and tags `v<version>`. `main` holds sources;
`dist/` is ignored.

