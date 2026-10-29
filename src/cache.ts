import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** What is no input of a render: a test of a component, a note about it. Editing one must not make every screen look new. */
const IGNORED = /\.(?:test|spec)\.[cm]?[jt]sx?$|\.md$/

/** Content, not a directory's mtime: editing an imported stylesheet must invalidate its consumers. */
export function fingerprintPaths(paths: string[]): string {
  const hash = createHash('sha256')
  const visited = new Set<string>()
  const visit = (path: string): void => {
    path = resolve(path)
    if (visited.has(path)) return
    visited.add(path)
    hash.update(JSON.stringify(path))
    try {
      const stat = statSync(path)
      if (stat.isDirectory()) {
        hash.update('directory')
        for (const name of readdirSync(path).sort()) {
          if (name.startsWith('.') || name === 'node_modules' || IGNORED.test(name)) continue
          visit(join(path, name))
        }
      } else if (stat.isFile()) {
        hash.update('file')
        hash.update(readFileSync(path))
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      hash.update('missing')
    }
  }
  paths.forEach(visit)
  return hash.digest('hex')
}
