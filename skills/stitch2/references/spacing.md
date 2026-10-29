# Space around elements

How much room a control, a group and a container keep from each other. The numbers come from Material 3, WCAG 2.2, Fluent 2 and
the Red Hat design system (see [guides.md](guides.md)); DESIGN.md says which steps this project uses. A rule that a check
measures names the check; the rest is for the agent to look at.

## Proximity: space says what belongs together

- **Inside a group is smaller than between groups, by at least one step** (the Gestalt law of proximity; Fluent: "as more space is
  added between elements, their perceived relationship weakens"). A label 4–8px above its field, a field 16px from the next, a
  group of fields 24–32px from the next, a section 32px or more. Same spacing for same relation, everywhere on the page.
- **One scale** of a few steps on a 4px base (Fluent's ramp, Refactoring UI): 4, 8, 12, 16, 24, 32. Never a value between two
  steps; start with too much and take away.
- **A container's padding is at least the gap between its children**, so content is never nearer the edge than it is to itself.
- **Between controls: 8px or more** (Material: touch targets 48dp "with at least 8dp of space between targets"; WCAG 2.5.8: an
  undersized target needs a 24px circle that meets no other target) **(check: tap-target, tap-spacing)**.
- **A field over the list it filters** (a picker's search over its options, a combobox over its suggestions) takes 12px: the ring
  is 4px of it, and the list should still be 8px away.

## Room for the ring and for the fill

A focus ring reaches 4px past the box (2px wide, 2px offset), and a control that fills on hover, press or selection fills its
whole box, usually 44px high. Both are drawn outside what the eye takes for the control, and both are cut or crowded when the
space around the control is not there.

- **A container that clips leaves 4px around the controls it holds** (overflow hidden or scroll, a dialog or panel surface, a
  table frame with rounded corners). Put the padding on the container (Red Hat: "prefer adding padding to the container to keep the
  default outer focus ring visible"). A scroller takes `scroll-padding` of the same size, or a snap to the first item hides the
  padding and cuts the ring. A ring drawn inside (`outline-offset: -2px`) is for a container that cannot have padding, such as a
  list that runs to its edges, and the row should say so **(check: ring-clipped)**.
- **The box of a control keeps 4px from the edge of what it sits on**, and from a neighbouring surface: a bar of 44px controls is
  52px high, a heading row of 44px sort buttons is 52px, and a hover fill never touches the navigation's edge, a card's edge or a
  table frame. The exceptions are content: a control that fills a surface on three sides (a picture that opens), a square row that
  spans its card, a link that is only its words, and a shape that paints inside its own box (a round or glass icon, measured by what
  it paints) **(check: edge-flush)**.
- **One ring.** A row that draws the ring (a choice: its box and its words) is the ring, and the box inside it draws none. Two rings
  at once read as a glitch, and one of them is usually the one that is cut **(check: ring-double)**.

## Edges and alignment

- **What aligns to the column is what the control shows**: the words for a control that is only words, the box for a boxed one.
  In a bar of text links every control is a text control and its words end on the column's edge; one boxed control in that row puts
  its words a padding inside the edge and looks pasted in.
- **Inner corners follow outer corners**: the radius inside is the outer radius minus the padding between them (Apple's concentric
  shapes), so a ring and a fill that sit near a rounded edge stay parallel to it.

## When a check reports

1. Read the message: it names the side and the container.
2. Fix it in the component, once: padding on the container, a taller bar or row, one ring. Not a smaller ring or a negative margin on
   the page.
3. If the control is meant to be flush (a picture, a full-width row), make it say so: a square row, or a control that fills the
   surface, is not reported.
