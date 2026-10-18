import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { findScreenRefs, rewriteScreenRefs } from '../src/screens.ts'

test('findScreenRefs reads screen links from src and href', () => {
  const html = [
    '<gg-phone-frame src="/screens/workout/mobile-v3.html" width="270"></gg-phone-frame>',
    '<a href="../agent/desktop-v2.html">coach</a>',
    '<link href="/tokens.tailwind.css" />',
  ].join('\n')
  assert.deepEqual(findScreenRefs(html), [
    { screen: 'workout', device: 'mobile', version: 3 },
    { screen: 'agent', device: 'desktop', version: 2 },
  ])
})

test('rewriteScreenRefs bumps only earlier versions of that screen and device', () => {
  const html = [
    '<gg-phone-frame src="/screens/workout/mobile-v2.html" />',
    '<gg-phone-frame src="/screens/workout/mobile-v3.html" />',
    '<gg-phone-frame src="/screens/workout/desktop-v1.html" />',
    '<gg-phone-frame src="/screens/plan/mobile-v2.html" />',
    '<gg-phone-frame src="/screens/workout/mobile-v4.html" />',
  ].join('\n')
  const next = rewriteScreenRefs(html, 'workout', 'mobile', 3)
  assert.ok(!next.includes('workout/mobile-v2.html'), 'earlier version is gone')
  assert.ok(next.includes('/screens/workout/desktop-v1.html'), 'another device keeps its version')
  assert.ok(next.includes('/screens/plan/mobile-v2.html'), 'another screen keeps its version')
  assert.ok(next.includes('/screens/workout/mobile-v4.html'), 'a newer proposal keeps its version')
})

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))

test('approving a variant moves other screens links to it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stitch2-links-'))
  const screen = (name: string, file: string, status: string, body = '') => {
    mkdirSync(join(dir, 'design/screens', name), { recursive: true })
    writeFileSync(
      join(dir, 'design/screens', name, file),
      `<html><head><meta name="s2-status" content="${status}" /></head><body>${body}</body></html>`,
    )
  }
  screen('workout', 'mobile-v2.html', 'approved')
  screen('workout', 'mobile-v3.html', 'review')
  screen('landing', 'mobile-v3.html', 'approved', '<gg-phone-frame src="/screens/workout/mobile-v2.html" />')
  const run = (...args: string[]) =>
    execFileSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8' })
  const out = run('approve', 'workout/mobile-v3')
  assert.match(out, /approved workout v3 mobile/)
  assert.match(out, /relinked screens\/landing\/mobile-v3\.html/)
  assert.match(
    readFileSync(join(dir, 'design/screens/landing/mobile-v3.html'), 'utf8'),
    /\/screens\/workout\/mobile-v3\.html/,
  )
  assert.match(
    readFileSync(join(dir, 'design/screens/workout/mobile-v2.html'), 'utf8'),
    /<meta name="s2-status" content="archived"/,
  )
})
