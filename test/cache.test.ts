import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fingerprintPaths } from '../src/cache.ts'

test('shared assets invalidate on edits, additions and deletions, even with restored mtimes', () => {
  const root = mkdtempSync(join(tmpdir(), 'stitch2-cache-'))
  try {
    const assets = join(root, 'components')
    mkdirSync(assets)
    const css = join(assets, 'controls.css')
    writeFileSync(css, 'button { color: red }')
    const originalTime = statSync(css)
    const original = fingerprintPaths([assets])
    assert.equal(fingerprintPaths([assets]), original)
    writeFileSync(css, 'button { color: tan }')
    utimesSync(css, originalTime.atime, originalTime.mtime)
    const edited = fingerprintPaths([assets])
    assert.notEqual(edited, original)
    const added = join(assets, 'controls.js')
    writeFileSync(added, 'export const active = true')
    assert.notEqual(fingerprintPaths([assets]), edited)
    rmSync(added)
    assert.equal(fingerprintPaths([assets]), edited)
    rmSync(css)
    assert.notEqual(fingerprintPaths([assets]), edited)
  } finally {
    rmSync(root, { recursive: true })
  }
})

test('a missing dependency becoming available invalidates its fingerprint', () => {
  const root = mkdtempSync(join(tmpdir(), 'stitch2-cache-'))
  try {
    const file = join(root, 'tokens.css')
    const absent = fingerprintPaths([file])
    writeFileSync(file, ':root { --gap: 1rem }')
    assert.notEqual(fingerprintPaths([file]), absent)
  } finally {
    rmSync(root, { recursive: true })
  }
})
