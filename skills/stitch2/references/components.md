# Components: reuse before you create

Screens are assembled from the project's shared components: light-DOM custom elements named
`<prefix>-<name>` (the prefix from `stitch2.config.json`), each rendering the same markup with the type levels
and every state, and marking itself `data-<prefix>="<name>"`. The **component catalog** (a screen in the
config's `catalogDir`, first on the canvas) shows every component with its variants, and it is the reference
`check` and `stitch2 consistency` compare every screen with. The project skill lists its components.

Two screens that both show a tab bar, a header, a list or a button must show the same one: same size, type,
colour, icons and states. Users learn an element once; every variant costs attention and looks like a mistake.

## The ladder

Open the catalog first (on the canvas, or its render under `<design>/renders/`): every element of the
screen is mapped to a component before any markup is written, and the mapping is part of the hand-over.
Go down only when the step above cannot work:

1. **Use** a component as it is.
2. **Use a variant** it already has (variant, size, selected, state…).
3. **Adapt the content** to the component: a shorter label, an icon it supports, two rows instead of a custom
   grid. A brief describes what to show, not which markup to invent.
4. **Extend the component**: add the attribute or variant to the component, show it in the catalog, describe it
   in DESIGN.md if it is a new look. Every screen gets it, and the change is reviewed once.
5. **Create a component** only when nothing fits and the element appears on more than one screen; give it a
   name, add it to the catalog and the project skill. A one-screen element may stay plain markup.

Never restyle a component on one screen, copy its markup by hand, or build a near-twin ("a chip, but 30 px").

## States

Every interactive component has its states, defined once in the component and described in DESIGN.md:

| State | What changes (DESIGN.md says how) |
|---|---|
| Hover (pointer only) | the surface lightens or the text brightens one step |
| Pressed | darkens one step and moves 1 px (or scales to 0.95); on a touch screen this is the only feedback |
| Focus (keyboard) | a ring, never removed without a replacement |
| Selected / current | shown by the accent or a raised surface; hover and press may stay as they are |
| Disabled | faint, no hover or press change, the reason nearby |
| Cursor (pointer only) | the hand over everything that acts when clicked (buttons, links, chips, rows that open something, switches, selects); not-allowed over a disabled control; the text cursor only in fields |

The cursor comes from one rule, not from each component: `stitch2 tokens` writes it into tokens.css and every
`css` and `tailwind4` export, in `@layer base`, because Tailwind v4's preflight gives buttons the arrow. A
clickable element that is not a button or a link gets `role="button"` (and a keyboard handler), which also gives
it the hand. Override the cursor only with a reason (`cursor-grab` on a drag handle).

The catalog shows each component in each of its **data states** (selected, done, active, disabled, error, with
and without an icon). Hover, focus and pressed are not drawn by hand: `stitch2 check` on the catalog forces them on
every control and writes the **States** sheet (canvas sidebar), each control at rest, hovered, focused and
pressed side by side. It reports a control that gives no feedback (**state-feedback**, **state-hover**,
**state-pressed**: pressing adds nothing to hover, so a tap shows nothing) and text that loses contrast in a state
(**state-contrast**), and a clickable control the pointer doesn't show as clickable (**state-cursor**). Fix them
in the component, once. Selected and current controls and text fields are exempt from the feedback checks.

## Components from the app

When the project builds its elements from the app's own components (`stitch2/elements›, bundled with
`stitch2 elements <entry>›), the catalog and every screen show exactly what the app renders. Then a change to
a component is a change to the app's component: edit it there, rebuild the bundle, and look at the catalog;
never patch the bundle or restyle the element on a screen. Props are the element's attributes (kebab-case,
an empty attribute is true) and its content is children. A component the screens need but the app lacks is
added to the app first, with the same name.

Keep native field IDs and their external label, ARIA and fragment references stable when nesting components.
`stitch2/elements` preserves IDs from the element being replaced; only real collisions outside that element
are renamed, together with references inside the component. Test both cases when changing a shared form.

## Colours come from DESIGN.md

Every colour on a screen and in a component is one of DESIGN.md's: a token class (`bg-surface`,
`text-muted`, …) or `var(--<prefix>-<name>)`, and for a shade a mix of those
(`color-mix(in srgb, var(--<prefix>-accent) 30%, transparent)`). Then a colour changed in DESIGN.md and
`stitch2 tokens` changes every screen at once. A colour DESIGN.md lacks (an illustration's backdrop, a chart
series) is added to DESIGN.md first, with a line in the prose saying where it is used.

## What the checks report

- **reuse** (an error: it fails `check --strict` and blocks the hand-over): on a lab screen, an element that
  looks like a catalog component but was built by hand (a bottom bar with three or more buttons, an h1,
  a primary-filled button, a pill chip, a header icon button, a caps label). A screen that duplicates a
  component instead of using it is not handed over: use the component, or extend it (step 4 of the ladder)
  when it cannot do what the screen needs.
- The reuse detector reports what is actually drawn: descendants of a closed `<details>`, screen-reader-only or
  clipped nodes, and elements hidden by a transparent ancestor are ignored. This keeps collapsed menus and
  accessibility-only labels from becoming false component errors. A faithful app snapshot marked with
  `<meta name="<prefix>-source" content="app">` is a visual baseline, not a component implementation, so its
  markup is not reuse-checked; make a new lab-authored version before editing the snapshot.
- **consistency**: a component whose size, radius, font, icon set or icons differ from the catalog's version
  (or, without a catalog, from the majority of screens in its family), or that appears in two versions on one
  screen. `stitch2 consistency` shows the same as cropped images; see the stitch2-consistency skill.
- **color**: a hex, `rgb()` or `hsl()` value in a lab screen's markup, or (reported on the catalog) in the
  component scripts it loads, with the file and line.
- **state-***: from the catalog's States sheet, above.

## Generated drafts

Generators such as Google Stitch produce each screen on its own and cannot share components, so their chrome
drifts from screen to screen. Treat generated screens as drafts of layout and content; the catalog decides how
shared components look. When a draft has a better element, adopt it by changing the component (step 4).
