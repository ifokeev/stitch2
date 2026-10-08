#!/usr/bin/env node
// Publishes a build to the release branch: builds dist/, packs exactly what npm would publish, commits that
// to "release" (no sources, no build step for installers) and tags it v<version>. Projects install
//   github:ifokeev/stitch2#release   (latest)   or   github:ifokeev/stitch2#v<version>   (pinned).
// Usage: pnpm release   (from a clean main; bump "version" in package.json first for a new tag)
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const tag = `v${version}`
if (run('git', ['status', '--porcelain'])) throw new Error('commit or stash your changes first')
if (run('git', ['tag', '--list', tag])) throw new Error(`${tag} exists: bump "version" in package.json`)
const head = run('git', ['rev-parse', '--short', 'HEAD'])

run('npm', ['run', 'build'])
const tmp = mkdtempSync(join(tmpdir(), 'stitch2-release-'))
const tarball = run('npm', ['pack', '--pack-destination', tmp]).split('\n').at(-1)
run('tar', ['-xzf', join(tmp, tarball), '-C', tmp])

// A worktree on the release branch (created on the first release), replaced with the packed files.
const wt = join(tmp, 'release')
const remote = run('git', ['ls-remote', '--heads', 'origin', 'release'])
if (remote) {
  run('git', ['fetch', 'origin', 'release'])
  run('git', ['worktree', 'add', '-B', 'release', wt, 'origin/release'])
} else {
  run('git', ['worktree', 'add', '--detach', wt])
  run('git', ['checkout', '--orphan', 'release'], wt)
}
for (const f of readdirSync(wt)) if (f !== '.git') rmSync(join(wt, f), { recursive: true, force: true })
cpSync(join(tmp, 'package'), wt, { recursive: true })
run('git', ['add', '-A'], wt)
run('git', ['commit', '-q', '-m', `release ${tag}`, '-m', `Built from main ${head}.`], wt)
run('git', ['tag', tag], wt)
run('git', ['push', '-q', 'origin', 'release', tag], wt)
run('git', ['worktree', 'remove', '--force', wt])
console.log(`released ${tag} (from ${head}): install github:ifokeev/stitch2#${tag} or #release`)
