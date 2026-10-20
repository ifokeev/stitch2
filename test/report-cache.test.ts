import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

test('a filtered consistency refresh cannot bless stale crops from a changed screen', () => {
  const root = mkdtempSync(join(tmpdir(), 'stitch2-report-cache-'))
  try {
    mkdirSync(join(root, 'design/screens/home'), { recursive: true })
    writeFileSync(join(root, 'design/DESIGN.md'), '---\nname: Cache test\ncolors: {}\n---\n')
    writeFileSync(join(root, 'stitch2.config.json'), JSON.stringify({ name: 'Cache test', designDir: 'design', prefix: 'ct' }))
    const screen = join(root, 'design/screens/home/mobile-v1.html')
    const markup = '<!doctype html><html><head><meta name="ct-device" content="mobile"></head><body style="font:16px sans-serif"><header data-ct="header">Original heading</header><button data-ct="button" data-variant="primary">Save</button></body></html>'
    writeFileSync(screen, markup)
    const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
    const run = (...kinds: string[]) => execFileSync(process.execPath, [cli, 'consistency', ...kinds], { cwd: root, env: { ...process.env, STITCH2_CONFIG: join(root, 'stitch2.config.json') }, stdio: 'pipe' })
    const entry = () => JSON.parse(readFileSync(join(root, 'design/consistency/known.json'), 'utf8'))['screens/home/mobile-v1.html']
    const output = run()
    const original = entry()
    assert.ok(original, output.toString())
    assert.ok(original.kinds.includes('all'))
    assert.ok(original.crops.header?.length)
    writeFileSync(screen, markup.replace('Original heading', 'Changed heading'))
    run('button')
    const filtered = entry()
    assert.notEqual(filtered.sourceKey, original.sourceKey)
    assert.ok(!filtered.kinds.includes('all'), 'old uncropped families must not be marked fresh')
    assert.equal(filtered.crops.header, undefined)
    run()
    const refreshed = entry()
    assert.ok(refreshed.kinds.includes('all'))
    assert.ok(refreshed.crops.header?.length)
  } finally {
    rmSync(root, { recursive: true })
  }
})
