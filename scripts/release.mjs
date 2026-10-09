#!/usr/bin/env node
// Tags the current main commit v<version> and pushes the tag. The tag push runs .github/workflows/publish.yml,
// which builds, tests and publishes that commit to npm through trusted publishing.
// Usage: pnpm release   (from a clean main that matches origin; bump "version" in package.json first)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const tag = `v${version}`
if (run('git', ['status', '--porcelain'])) throw new Error('commit or stash your changes first')
if (run('git', ['branch', '--show-current']) !== 'main') throw new Error('release from main')
run('git', ['fetch', '-q', 'origin', 'main', '--tags'])
if (run('git', ['rev-parse', 'HEAD']) !== run('git', ['rev-parse', 'origin/main'])) throw new Error('push main first')
if (run('git', ['tag', '--list', tag])) throw new Error(`${tag} exists: bump "version" in package.json`)

run('git', ['tag', '-a', tag, '-m', `stitch2 ${tag}`])
run('git', ['push', '-q', 'origin', tag])
console.log(`tagged ${tag}: the publish workflow builds, tests and publishes it to npm`)
