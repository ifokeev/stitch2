# Motion: how screens move

Motion confirms what just happened (a set ticked, a sheet opened) and shows where things come from. It is part
of the design system, like colour: durations and easings are **motion tokens** in DESIGN.md, components use them,
and screens get motion from their components. A static screen cannot show movement, so the rules live in
DESIGN.md's prose and in the components, and the checks hold them.

## Tokens

stitch2 extends DESIGN.md's front matter with a `motion:` section (Google's format has none yet; `stitch2 lint`
leaves out the linter's note about the key). `stitch2 init` writes Material's values:

```yaml
motion:
  duration-short: 150ms    # a control's own change: press, toggle, tick
  duration-medium: 250ms   # something entering or opening: a sheet, a menu, a toast
  duration-long: 400ms     # a whole screen changing
  ease-standard: cubic-bezier(0.2, 0, 0, 1)      # movement inside the screen
  ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1)    # what arrives (decelerates)
  ease-exit: cubic-bezier(0.3, 0, 0.8, 0.15)     # what leaves (accelerates)
```

`stitch2 tokens` makes them `--<prefix>-duration-short` and `--<prefix>-ease-standard` variables, `ease-standard` and
`duration-short` classes in the Tailwind 4 export, and sets Tailwind's plain `transition` (and `transition-colors`,
…) to duration-short with ease-standard, so a component that only says `transition` already follows them.

## Rules

- **Animate transform and opacity.** Moving layout properties (width, top, margin) janks and reflows.
- **One duration per kind of change** from the tokens; never a typed value (`duration-[180ms]`)
  **(check: motion-token)**. Bigger or farther changes take the longer token; nothing over long except a
  full-screen change.
- **Enter with ease-enter, leave with ease-exit**, and leave faster than you entered (medium in, short out).
- **Nothing moves on its own**, except a skeleton's pulse while content loads. No looping decoration, no
  staggered list entrances in the app (speed matters more), no parallax.
- **Reduced motion:** when the person asks for less motion, nothing moves: animations that move or scale are
  wrapped in `@media (prefers-reduced-motion: no-preference)` (Tailwind `motion-safe:`), and a fade or an instant
  change replaces them **(check: reduced-motion)**. Fades and colour changes may stay.
- **Feedback is instant:** a press shows within one frame (the pressed state), and the motion that follows never
  delays the next tap.
- **Describe screen-level motion in DESIGN.md's Motion & Interaction section** (how a sheet opens, what a tick
  does), in values: "slides up 250ms ease-enter", not "smoothly".

## On the canvas

Frames are pictures until you double-click one: then it is live, and its hover, press and transitions play.
The **States** sheet shows every control of the catalog at rest, hovered, focused and pressed (see
[components.md](components.md)).
