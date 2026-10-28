# Buttons, states and links

How a control is chosen, drawn and told apart from its neighbours. The numbers come from Material 3, WCAG 2.2 and
web.dev (see [guides.md](guides.md)); DESIGN.md says how this project draws each state, and the component carries it
once. A check that measures a rule is named; the rest is for the agent to look at.

## Choose the control

- **A button acts, a link goes.** Something that submits, opens a dialog, toggles or starts work is a button. Something
  that changes the address is a link. A destination in a bar or a footer is a link, not a button painted as text.
- **Emphasis follows importance.** Filled for the one main action of a region, tonal or outlined for a secondary one,
  text for a low one. A region is a card, a dialog, a form or a page without cards; one filled button each.
- **An action repeated** down a table, a list or a gallery (Generate, Open, Reproduce) is a tonal button, not a column
  of filled ones. The filled one belongs to the thing the page is for.
- **The label says what happens** (a verb and its object: "Buy credits", not "Submit"), and it is the same word on every
  screen. An icon-only button has a name that says what it does **(check: unnamed-control)**.

## States, one rule each

| State | The rule |
|---|---|
| Hover | One step: the fill lightens (Material: an 8% layer of the label colour) or the label brightens. Drawn only where the device can hover, inside `@media (hover: hover)`; outside it a tap leaves the control lit until the next tap **(check: state-hover-touch)**. |
| Focus | One ring, shown for the keyboard only (`:focus-visible`): 2px, offset 2px, at least 3:1 against what it touches (WCAG 1.4.11, 2.4.13). A recipe or a utility class never adds a second ring; two rings read as a glitch, and a ring drawn for a press cannot be told from focus. |
| Pressed | A 10% layer of the label colour over the fill (Material), drawn as an overlay so it works on any fill, and a 0.98 sink for a boxed control. No ring. A link or a plain line has no box: its label goes to the strong colour and is underlined, a step past hover **(check: state-pressed)**. |
| Selected, current | Shown by the accent or a raised surface; the control may keep its hover and press. |
| Disabled | 38–40% opacity (Material: content 38%, container 12%), no hover, press or pointer, and the reason nearby. A disabled control is skipped by the keyboard and screen readers, so it is not used for something that is only not there yet: write that as a line of text in the same place (`role="status"`). WCAG exempts it from contrast; do not rely on that for text people need. |
| Loading | The control is busy, not off: `aria-busy="true"`, the label and the width stay, a spinner leads the label, nothing is dimmed, a second press does nothing. With reduced motion the spinner stands still. |

Hover, focus and pressed are not drawn by hand: `stitch2 check` forces them on every control of the catalog, writes
the **States** sheet, and reports a control with no feedback (**state-feedback**, **state-hover**, **state-pressed**),
text that loses contrast in a state (**state-contrast**), a hand that is not the hand (**state-cursor**) and a hover
rule that stays on for touch (**state-hover-touch**). A state layer drawn as a gradient (`background-image`) counts.
Fix each in the component, once.

## Links

- **Not by colour alone** (WCAG 1.4.1, 3:1 rule): a link inside a sentence is underlined, or differs from the text
  around it by at least 3:1 and also changes on hover and focus. Underlined is the safe choice.
- **A quiet link** (an index, a "see all", a footer destination) still has 4.5:1 for its text at rest. Brightening on
  hover is the cue that it is a link; underlining on hover is the second cue for a footer.
- **The text names the destination** ("See pricing", "Read the guide"), never "here" or "click here".
- **The whole target is the hit area**, at least 44 px high in a bar or a list; text in a sentence is exempt from the
  size rule (WCAG 2.5.8) but not from the colour rule.

## Colour

- **Text on a fill** takes the fill's "on" colour at 4.5:1; a filled accent button keeps the same label colour in every
  theme **(check: contrast)**.
- **Tonal and text buttons** use the accent as the label colour on a low-opacity fill of itself (about 10%), so they
  stay quieter than the filled one on any surface.
- **Status colours** (success, warning, failure) are not button colours; a destructive action is a tonal or outlined
  button in the failure colour, confirmed in a dialog.

## Common faults

- A column of filled buttons, so nothing is the main action.
- A "Coming soon" or "Unavailable" label on a disabled button, which cannot be focused or read.
- A hover rule outside `@media (hover: hover)`, a second focus ring from a utility class, and a pressed ring that
  looks like focus.
- A link told apart only by colour, and a footer made of buttons.
- A loading state that disables the control: the label jumps, the focus is lost and a double press goes through.
