# Components: reuse before you create

Screens are assembled from the project's shared components: light-DOM custom elements named
`<prefix>-<name>` (the prefix from `stitch2.config.json`), each rendering the same markup with the type levels
and every state, and marking itself `data-<prefix>="<name>"`. The **component catalog** (a screen in the
config's `catalogDir`, first on the canvas) shows every component with its variants, and it is the reference
`check` and `stitch2 consistency` compare every screen with. The project skill lists its components.

Two screens that both show a tab bar, a header, a list or a button must show the same one: same size, type,
colour, icons and states. Users learn an element once; every variant costs attention and looks like a mistake.

## The ladder

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

## Components from the app

When the project builds its elements from the app's own components (`stitch2/elements›, bundled with
`stitch2 elements <entry>›), the catalog and every screen show exactly what the app renders. Then a change to
a component is a change to the app's component: edit it there, rebuild the bundle, and look at the catalog;
never patch the bundle or restyle the element on a screen. Props are the element's attributes (kebab-case,
an empty attribute is true) and its content is children. A component the screens need but the app lacks is
added to the app first, with the same name.

## Colours come from DESIGN.md

Every colour on a screen and in a component is one of DESIGN.md's: a token class (`bg-surface`,
`text-muted`, …) or `var(--<prefix>-<name>)`, and for a shade a mix of those
(`color-mix(in srgb, var(--<prefix>-accent) 30%, transparent)`). Then a colour changed in DESIGN.md and
`stitch2 tokens` changes every screen at once. A colour DESIGN.md lacks (an illustration's backdrop, a chart
series) is added to DESIGN.md first, with a line in the prose saying where it is used.

## What the checks report

- **reuse**: on a lab screen, an element that looks like a catalog component but was built by hand (a bottom
  bar with three or more buttons, an h1, a primary-filled button, a pill chip, a header icon button, a caps
  label).
- **consistency**: a component whose size, radius, font, icon set or icons differ from the catalog's version
  (or, without a catalog, from the majority of screens in its family), or that appears in two versions on one
  screen. `stitch2 consistency` shows the same as cropped images; see the stitch2-consistency skill.
- **color**: a hex, `rgb()` or `hsl()` value in a lab screen's markup, or (reported on the catalog) in the
  component scripts it loads, with the file and line.

## Generated drafts

Generators such as Google Stitch produce each screen on its own and cannot share components, so their chrome
drifts from screen to screen. Treat generated screens as drafts of layout and content; the catalog decides how
shared components look. When a draft has a better element, adopt it by changing the component (step 4).
