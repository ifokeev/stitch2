#!/usr/bin/env node
/**
 * stitch2: a design canvas, checks and screen versioning for agent-built UI.
 * Usage: stitch2 <command> [args]   (reads the nearest stitch2.config.json)
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const COMMANDS: Record<string, [string, string]> = {
  canvas: [
    'serve.ts',
    'The canvas at http://127.0.0.1:4400 (PORT to change): screens, versions, DESIGN.md, approval',
  ],
  check: ['check.ts', '[filter] [--shots] [--strict]  Layout, type, reuse and consistency checks'],
  consistency: ['report.ts', '[kind]  Every shared component cropped from every screen, side by side'],
  type: ['type.ts', '[filter] [--json]  Every text style a screen uses, by type level'],
  tokens: ['tokens.ts', 'Generate tokens.css and tailwind.tokens.js from DESIGN.md'],
  lint: ['', "Google's DESIGN.md linter on the project's DESIGN.md"],
  screens: ['list.ts', '[name] [--status s] [--json]  Screen versions, statuses and notes'],
  localize: ['assets.ts', '[filter]  Copy remote images a screen uses into its assets/ folder'],
  sandbox: ['sandbox.ts', '<dir> <brief.md>…  An isolated folder for a blind design trial'],
}

const [command, ...rest] = process.argv.slice(2)
const entry = command ? COMMANDS[command] : undefined
if (!entry) {
  console.log('stitch2 <command>\n')
  for (const [name, [, help]] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(12)} ${help}`)
  process.exit(command ? 1 : 0)
}
if (command === 'lint') {
  const { ROOT } = await import('./config.ts')
  // The linter's main entry is also its command line (the package only exports for import).
  const file = fileURLToPath(import.meta.resolve('@google/design.md'))
  try {
    execFileSync(process.execPath, [file, 'lint', join(ROOT, 'DESIGN.md'), ...rest], { stdio: 'inherit' })
  } catch {
    process.exit(1)
  }
} else {
  const script = fileURLToPath(new URL(entry[0], import.meta.url))
  process.argv = [process.argv[0]!, script, ...rest]
  await import(script)
}
