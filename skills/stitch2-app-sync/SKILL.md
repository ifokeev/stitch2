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
3. **Approval**: the user approves the new versions (or the catalog change) as for any design. Nothing goes into
   the app before this: a version in review is not implemented, not even partly. When the user asks to implement
   one in review, run `stitch2 approve` on it first; that archives the earlier versions, so the approved one is the
   single current version and the app matches it.
4. **App**: the app picks the component up; wire it, then run `stitch2 compare <screen>`.

A page in the app is its main screen and its states: implement its approved empty, loading and error screens with
it. The app's loader is the loading screen's skeleton, shown until the data arrives, never a blank page or a lone
spinner; data appearing all at once with no loading state is a bug. A page whose states were never designed goes
back to the canvas for them first.

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
  control-overlap), so a control squeezed in the app shows up even when no screen drew it. Each version runs at
  its drawn width and at both edges of its width range; a finding seen only at an edge starts with "at <width>px:".
- `stitch2 look` (the same routes): the words the screen and the app share, one by one, in the font, size, weight,
  letter spacing, line height, colour, case, alignment and decoration they are drawn in. Text on one side only is
  data and is counted, not reported.
- `stitch2 geometry` (the same routes): the size and left edge of every shared component and text, the space
  between neighbours, and whether two things sit beside each other or one under the other. It runs at the drawn
  width, both ends of the range and every breakpoint inside it, so a title that wraps under its icon at 1024px
  shows up. `--width 360,1280` picks widths and `--drawn` uses only the drawn one.
- Both reports are snapshots that run only when called. The canvas sidebar says "N changed since" once the
  screens they cover have changed; run them again before relying on them.
- Give every approved screen a route, and every state a `prepare` module that puts the app into it (a sheet
  open, a timer running, a form half filled). An unrouted screen is not compared at all.

Read the findings as:

| Finding | Meaning | Fix |
|---|---|---|
| `missing` in compare | The app does not use a component the design shows | Build that part from the component; if the data is missing, fix the `prepare` |
| `extra` in compare | The app shows a component the design does not | Fine if it is a kept feature the design leaves out; otherwise design it first |
| `control-overlap` / `overflow` in compare only | The app draws a state or control the canvas never showed | Show it on the canvas, fix the component there, then re-run both |
| `look` differences | The component is styled differently in the app | The app is overriding the component: remove the override, or change the component |
| `stitch2 look` reports a size, weight or colour | The app draws the words in a style the screen does not | Find the element from the tag and classes it prints; use the component's or the type level's class, not a hard-coded value |
| `stitch2 geometry` reports `size` or `position` | A component is wider, narrower or shifted against the screen | A wrapper, padding or width in the app's markup; the component carries its own |
| `stitch2 geometry` reports `gap` or `arrangement` | The space between two things, or how they are arranged, is not the screen's | The app's spacing or wrapping around the component; at one width only, a breakpoint is missing |
| A difference on text that is data (a name, a count, a list in another order) | The mock-up and the app hold different data | Not a bug: make the route's `prepare` put the same data on screen, or read it as noise |

## Before you call it done

1. Every screen you implemented is approved, and `stitch2 screens --strict` passes: one current version each.
2. `stitch2 check --strict` passes on the screens you touched (it leaves archived screens out).
3. `stitch2 compare` has no errors for the screens you touched; warnings are explained (a kept feature) or fixed.
4. `stitch2 look` and `stitch2 geometry` report nothing on the screens you touched, except differences you can
   name as data.
5. The user has seen the canvas versions of anything that changed how a component looks.
