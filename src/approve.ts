/**
 * Approves screen variants, as the user does on the canvas: each becomes the current version of its screen on its
 * device, and every earlier version there is archived. Agents run it when the user approves in words ("approve
 * the v3 screens"), never on their own.
 * Usage: stitch2 approve <path or filter…>   (a path under the design folder, or part of one: "connect/", "-v3")
 */
import { approve, listScreens } from './screens.ts'

const filters = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!filters.length) {
  console.error('stitch2 approve <path or filter…>: which variants? ("home/mobile-v3", "connect/", "-v3")')
  process.exit(1)
}
const targets = listScreens().filter(
  (s) => s.kind === 'screen' && s.status !== 'archived' && filters.some((f) => s.path.includes(f)),
)
if (!targets.length) {
  console.error(`No screen variant matches ${filters.join(', ')}.`)
  process.exit(1)
}
// Oldest first, so approving several versions of one screen leaves the latest current.
targets.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
for (const t of targets) {
  const archived = approve(t.path)
  const note = archived.length ? `; archived ${archived.map((s) => s.version).join(', ')}` : ''
  console.log(`approved ${t.screen} ${t.version} ${t.device}${note}`)
}
