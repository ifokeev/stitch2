import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type PageComponents, reuseIssues } from '../src/consistency.ts'

const page = (kinds: string[]): PageComponents =>
  ({ handBuilt: kinds.map((kind) => ({ kind, selector: kind, text: kind })) }) as PageComponents

test('a hand-built copy of a catalog component is an error', () => {
  const issues = reuseIssues('screens/home/mobile-v1.html', page(['chip']))
  assert.equal(issues.length, 1)
  assert.equal(issues[0].severity, 'error')
  assert.equal(issues[0].type, 'reuse')
  assert.match(issues[0].message, /built by hand/)
})

test('generated and trial screens are exempt: they cannot share components', () => {
  assert.deepEqual(reuseIssues('stitch/home.html', page(['chip'])), [])
})
