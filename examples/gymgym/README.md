# Example: gymgym

The design of [gymgym](https://github.com/ifokeev/gymgym), a workout tracker, made with stitch2: DESIGN.md, a
component catalog (`gg-*` web components in `design/components/gg.elements.js`) and 15 approved screens, each for
mobile and desktop.

From the stitch2 repository root, after `pnpm install` and `npx playwright install chromium`:

```bash
STITCH2_CONFIG=examples/gymgym/stitch2.config.json node src/cli.ts canvas
STITCH2_CONFIG=examples/gymgym/stitch2.config.json node src/cli.ts check
```

The product video in [video/](../../video) is recorded on a copy of this example.

Licence: this folder is part of gymgym and is licensed AGPL-3.0, like gymgym. `design/components/gg.elements.js`
bundles gymgym's UI components; the rest of stitch2 is MIT.
