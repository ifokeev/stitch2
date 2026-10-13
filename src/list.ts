/**
 * Lists every screen version, variant by variant (mobile, desktop), with its status and the reviewer's note, for agents (and anyone without the
 * canvas open). Approved versions are the reference; review versions wait for the user; notes are feedback.
 * Ends with what makes the current version unclear (versionProblems); --strict fails on it.
 * Usage: stitch2 screens [screen name] [--status approved|review|draft|archived] [--json] [--strict]
 */
import { listScreens, versionProblems } from './screens.ts'

const args = process.argv.slice(2)
const status = args.includes('--status') ? args[args.indexOf('--status') + 1] : undefined
const name = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--status')
const rows = listScreens()
  .filter((s) => s.kind === 'screen' && (!status || s.status === status) && (!name || s.screen === name))
  .sort(
    (a, b) =>
      a.screen.localeCompare(b.screen) ||
      a.version.localeCompare(b.version, undefined, { numeric: true }) ||
      b.device.localeCompare(a.device),
  )
if (args.includes('--json')) console.log(JSON.stringify(rows, null, 2))
else
  for (const s of rows)
    console.log(
      `${s.screen.padEnd(20)} ${s.version.padEnd(8)} ${s.device.padEnd(8)} ${s.status.padEnd(9)} ${s.path}${s.note ? `\n${' '.repeat(39)}note: ${s.note}` : ''}`,
    )

const problems = versionProblems().filter((p) => !name || p.startsWith(`${name} `))
if (problems.length && !args.includes('--json')) {
  console.log(`\nWhich version is current is unclear (${problems.length}):`)
  for (const p of problems) console.log(`  ${p}`)
}
if (problems.length && args.includes('--strict')) process.exit(1)
