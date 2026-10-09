---
name: stitch2-app-sync
description: Keep the live app and the approved designs in step when both are built from the same components. Use when changing a shared component the app uses, building or fixing an app screen from an approved design, adding a state or control the app needs (a paused timer, an error, an empty list), or when stitch2 compare reports missing components or layout errors in the app.
---

# Keeping the app and the designs in step

The screens on the canvas and the app use **the same components** (one definition each, rendered by both). The
canvas is where a component's look is decided and checked; the app wires the component to real data. Drift starts
when the app draws something the canvas never showed: a control added only in the app, a state no screen has,
a component rebuilt by hand. The checks can only judge what the canvas draws, so those slip through.

## The direction of change

**Design first, then the app.** A visible change to a shared component goes:

1. **Component**: change it (or add the variant) in the component library, never in the app's copy of a screen.
2. **Canvas**: rebuild the elements bundle, show the change on the screens that use it (a new version of each
   approved screen if the change is visible there; a catalog entry for a new variant or state), and run
   `stitch2 check <screens> --strict`. Look at the screens yourself: the check finds overlaps and overflow, not
   ugliness.
3. **Approval**: the user approves the new versions (or the catalog change) as for any design.
4. **App**: the app picks the component up; wire it, then run `stitch2 compare <screen>`.

Fixing a bug found in the app follows the same path: reproduce it on the canvas (a screen or catalog state that
shows it), fix the component, check, then the app. If the canvas cannot show the bug, the canvas is missing a
state: add it.

## What the app may and may not add

| The app needs | Do |
|---|---|
| Real data, handlers, routing, test ids | Props on the component (`onClick`, `onSelect`, `testId`); no change in look |
| Its own control where the screen shows a value (an input where the design shows a number) | A slot that keeps the component's look: same size, type and colour as the value it replaces |
| A new visible part (a pause button, a badge, a second line) | Add it to the component with its own props, and show it on a screen first. Never through a generic "extra" slot |
| A state the screens do not have (loading, empty, error, paused, ready) | A screen version or catalog entry for that state first |
| A whole new screen or sheet | Design it on the canvas first; until then it is unfinished, and the user should know |

Slots are for wiring. If what goes into a slot changes how the component looks, it belongs in the component.

## Checks that keep them honest

- `stitch2 check` (screens): overflow, labels that wrap, content under fixed bars, fixed bars overlapping each
  other, **controls overlapping each other**, small tap targets, contrast, type levels, reuse and consistency.
- `stitch2 compare` (the live app, against every approved version with a route): which components appear, in
  what order, how the measured ones look, **and the same layout errors as check** (overflow, fixed-overlap,
  control-overlap), so a control squeezed in the app shows up even when no screen drew it.
- Give every approved screen a route, and every state a `prepare` module that puts the app into it (a sheet
  open, a timer running, a form half filled). An unrouted screen is not compared at all.

Read the findings as:

| Finding | Meaning | Fix |
|---|---|---|
| `missing` in compare | The app does not use a component the design shows | Build that part from the component; if the data is missing, fix the `prepare` |
| `extra` in compare | The app shows a component the design does not | Fine if it is a kept feature the design leaves out; otherwise design it first |
| `control-overlap` / `overflow` in compare only | The app draws a state or control the canvas never showed | Show it on the canvas, fix the component there, then re-run both |
| `look` differences | The component is styled differently in the app | The app is overriding the component: remove the override, or change the component |

## Before you call it done

1. `stitch2 check --strict` passes on the screens you touched (archived screens excepted).
2. `stitch2 compare` has no errors for the screens you touched; warnings are explained (a kept feature) or fixed.
3. The user has seen the canvas versions of anything that changed how a component looks.

