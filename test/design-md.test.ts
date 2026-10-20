import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cssFontStack, typeLevels } from '../src/design-md.ts'

test('type levels normalize CSS units to the pixels used by the checker', () => {
  const [display, body, label] = typeLevels({
    name: 'test',
    colors: {},
    rounded: {},
    spacing: {},
    components: {},
    motion: {},
    typography: {
      display: {
        fontFamily: 'Display Sans',
        fontSize: '2.25rem',
        lineHeight: '1.15',
        fontWeight: 600,
        letterSpacing: '0.02em',
      },
      body: {
        fontFamily: 'Body Sans',
        fontSize: '18px',
        lineHeight: '150%',
        fontWeight: 400,
        letterSpacing: '0.1rem',
      },
      label: {
        fontFamily: 'Label Sans',
        fontSize: '1em',
        lineHeight: '1.25em',
        fontWeight: 500,
        letterSpacing: '1px',
      },
    },
  })
  assert.deepEqual(
    [display, body, label].map((level) => [level.size, level.lineHeight, level.tracking]),
    [
      [36, 41.4, 0.72],
      [18, 27, 1.6],
      [16, 20, 1],
    ],
  )
})

test('font stacks preserve commas and quote one multi-word family', () => {
  assert.equal(cssFontStack('Plus Jakarta Sans'), '"Plus Jakarta Sans"')
  assert.equal(cssFontStack('Plus Jakarta Sans, system-ui, sans-serif'), 'Plus Jakarta Sans, system-ui, sans-serif')
  assert.equal(cssFontStack('"Plus Jakarta Sans", system-ui, sans-serif'), '"Plus Jakarta Sans", system-ui, sans-serif')
  assert.equal(cssFontStack('system-ui'), 'system-ui')
})
