# Contributing to stitch2

Thanks for helping. Issues and pull requests are welcome: bugs, checks that misfire or miss something, rules in the
skills that steer agents wrong, and support for more design systems.

## Set up

```bash
git clone https://github.com/ifokeev/stitch2 && cd stitch2
pnpm install
npx playwright install chromium
pnpm typecheck
pnpm test
```

Run a command from the sources in any project with `node /path/to/stitch2/src/cli.ts <command>` (or point it at a
config with `STITCH2_CONFIG=/path/to/stitch2.config.json`).

## Sending a change

1. Keep it focused, and try it on a real project: look at the screens, not only the numbers.
2. A new or changed check comes with its rule in the skill that tells agents to run it, and the skills never promise
   something the code does not do. [AGENTS.md](AGENTS.md) has the full list of rules; agents read it too.
3. `pnpm typecheck` and `pnpm test` pass; CI runs them on every pull request.
4. Commits follow [Conventional Commits](https://www.conventionalcommits.org), with a body that explains why.

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
