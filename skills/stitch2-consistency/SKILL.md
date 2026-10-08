---
name: stitch2-consistency
description: Verify that shared elements (tab bar, header, buttons, chips, icon buttons, section labels, rows…) look the same on every screen, and fix drift the right way. Use when screens look inconsistent, after generating or importing screens (Stitch exports, a new flow), before asking the user to approve, or when check reports reuse or consistency warnings.
---

# Verifying design consistency with stitch2

A shared element must be the same everywhere: same size, radius, type, colour, icon set, icons and states.
stitch2 measures this; your job is to read the evidence, decide what is wrong, and fix it at the source. The
reference is the **component catalog** (the screen in the config's `catalogDir`); without a catalog, the
majority of screens in the same family.

## 1. Measure

1. `stitch2 check` over **all** screens (no filter), so every screen's components are known; later filtered runs
   compare with them.
2. `stitch2 consistency` (or `stitch2 consistency tab-bar header` for some kinds): crops every shared component
   from every active screen into one page, next to the catalog's version, with what differs. Open it from the
   canvas sidebar (Consistency report) or view the crops under `<design>/consistency/<kind>/`.
3. Read the warnings, per screen (`<design>/checks.json`, or the canvas inspector):
   - `consistency`: "Tab bar differs from the component catalog: label 13/500 (catalog 11/500); iconSet
     material-symbols (catalog lucide); icons home,… (catalog house,…)". Every field is a fact:
     `height`/`width`/`radius` in px, `font` and `label` as size/weight/family/tracking, `icon` size,
     `iconSet` and `icons` (the glyph names), and for a tab bar its centre `circle` and `lift`.
   - `… different versions … on this screen`: the same component styled two ways on one screen.
   - `reuse`: a lab screen built a catalog component by hand instead of using it.
4. Look at the crops yourself. Numbers say what differs; the images say whether it matters. A 1 px height
   difference from a border is noise; another icon set, label size or button shape is not.

## 2. Decide, per difference

| What you see | Fix |
|---|---|
| A lab screen rebuilt a component by hand (`reuse`) | Replace the markup with the component, in a new version if the screen is approved |
| A lab screen restyled a component (extra classes) | Remove the overrides; if the change was wanted, extend the component (step 4 of the ladder) |
| A generated draft (Stitch) has its own chrome | Rebuild the draft from components as a new lab version, keeping its layout and content; or leave it and record it, because drafts are not implemented |
| The draft's element is better than the catalog's | Change the component and the catalog (and DESIGN.md if it is a new look), then re-run the checks: every screen follows |
| Two versions of one component on a screen | Pick the catalog's; if both are needed, they are two variants: add the variant to the component |
| The catalog itself is missing the variant a screen needs | Add it to the component and the catalog first, then use it |

Never fix consistency by editing one screen to imitate another by hand, and never edit an approved version:
make the next version.

## 3. Verify and report

1. Re-run `stitch2 check` and `stitch2 consistency`: the fixed screens show "matches" in the report and no
   `reuse`/`consistency` warnings.
2. Tell the user, per component, which screens matched, which you fixed (and how: component used, component
   extended, new version), and which differ on purpose (drafts you left, with the reason). Point to the report
   on the canvas so they can see it.

## Rules for every screen you build

- Build from the catalog; check the catalog before writing any shared element.
- One icon set (DESIGN.md names it); the same glyph for the same meaning on every screen.
- Same chrome in the same place: header, tab bar or sidebar, safe-area padding.
- Changes to shared elements happen in the component, never per screen.
