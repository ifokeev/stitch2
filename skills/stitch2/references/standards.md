# Checks that come from standards

What check measures because a published standard asks for it, not because one project chose it. Each row names the check, the standard,
what it looks at and how to fix it. The layout checks (overflow, tap targets, inset, focus-visible) are in [principles.md](principles.md),
[spacing.md](spacing.md) and [buttons.md](buttons.md); the colour contrast of text is in the colour checks. All of these are warnings:
a person decides, and a screen that has a reason says so in its notes.

| Check | Standard | It reports | Fix |
|---|---|---|---|
| reflow | WCAG 1.4.10 | A phone-sized screen scrolls sideways, or something sticks out, at 320px (a desktop window at 400% zoom). Off with `"reflow": false` in the config. | Let it wrap, shrink, or scroll inside its own box; fix the header first (it is on every screen). |
| text-spacing | WCAG 1.4.12 | Text is cut when line height is 1.5, letters 0.12em and words 0.16em (and the page scrolls sideways). | A box with text has a minimum height, not a height. |
| heading-order, h1-count | WCAG 1.3.1, 2.4.6 | A heading skips a level (h1 then h3), or the page has no h1 or two. | Level by outline, size by class. |
| img-alt, img-broken | WCAG 1.1.1 | A picture with no alt attribute (`alt=""` is the answer for decoration), or one that does not load. | Say what it shows, or say nothing on purpose. |
| field-name | WCAG 3.3.2, 4.1.2 | A field with no label, aria-label or aria-labelledby (a placeholder is not a name). | A visible label; aria-label for a search box. |
| autocomplete | WCAG 1.3.5 | A field for an email, a password, a phone, a name or an address with no autocomplete token. | `autocomplete="email"`, `"current-password"`, `"new-password"`, `"tel"`, `"name"`. |
| page-lang, page-title, landmark-main, zoom-blocked | WCAG 3.1.1, 2.4.2, 2.4.1, 1.4.4 | No `lang`, no title, no main landmark, a viewport that blocks zoom. | One of each, and never `user-scalable=no` or `maximum-scale=1`. |
| dialog-name | ARIA authoring practices (dialog) | A dialog with no name, or with nothing to press. | `aria-labelledby` its title; a close control. |
| focus-order | WCAG 2.4.3, 1.3.2 | A reversed flex row, an item moved with `order`, or a `tabindex` above 0, around controls. | Write the document in the order it is drawn. |
| focus-forced-colors | MDN forced-colors, WCAG 2.4.7 | The focus is a shadow or a colour only: forced-colors mode (Windows High Contrast) removes both. | An outline (the ring of DESIGN.md is one). |
| focus-contrast | WCAG 1.4.11, 2.4.13 | The ring is under 3:1 against what it touches. | Link Lavender on the page is 7:1; a ring on a lavender fill is not. |
| field-edge | WCAG 1.4.11 | Neither the edge nor the fill of a field is 3:1 against what is behind it. One report for each way a field is drawn. | The field's border token reaches 3:1, or its fill does. A hairline of 8% is a decoration, not an edge. A field with no line of its own is seen by the frame that draws it (the composer of a chat), and a search row named by an icon and a placeholder needs none. |
| ring-clipped, ring-double, edge-flush | Material, Fluent, Red Hat, WCAG 2.4.7 | See [spacing.md](spacing.md). | Padding on the container; one ring; 4px around a control's box. |
| link-as-button | WCAG 4.1.2, HTML | A button in a bar or a footer that is not a menu, a toggle, a form control or pagination: a destination should be an anchor. | `<a href>`. |
| placeholder-fit | WCAG 1.4.4, 3.3.2 | A placeholder wider than its field (or taller than a textarea): it cannot scroll, so it is cut. | Shorten it, or give the field room. |
| label-centered, choice-alignment | Material (component anatomy) | The label of a button, summary or combobox is not in the middle of it; the words of a checkbox or a radio are not level with its box. | Centre with flex; share a line. |
| choice-ring | WCAG 2.4.7, 2.4.13; Material, Carbon, GOV.UK, Primer | The focus ring of a checkbox or a radio is drawn round a row far wider than its box, and the row is not one of a list of options. | Ring the box (the control that has focus); the label is room to press, not more to light. A row of a list of three or more options may ring the row. |
| select-two-arrows, icon-off-centre, row-heights | Material, project experience | A select with two arrows; an icon placed with `top: 50%` and no translate; cards of one row that end at different heights. | One arrow; `translate: 0 -50%`; stretch the row. |
| concentric-corner | Apple HIG (concentric shapes) | A rounded surface inside a rounded surface whose radius is not the outer less the space between them. | Outer radius less the padding. |
| word-space | DESIGN.md (Word-Space Rule) | A face whose word space is under 0.22em (the rule is 0.24em; hinting makes a good face measure 0.23). | Replace the face; tracking cannot repair it. |
| spacing-grid | DESIGN.md (Four-Pixel Rhythm Rule) | A padding, margin or gap off the 4px grid, once for each value. The padding above and below the line of a field or a button (what is left of its target height), an auto or fractional margin and a half step on a component of the system (a p2-* element) are not reported. | The nearest step; a half step only inside a component, as an optical correction. |
| type-family, type-fraction | DESIGN.md (Whole-Pixel Rule, type levels) | Text in a family DESIGN.md does not name (a control that fell back to the browser's), or a size or line height with a fraction. | Inherit the font on controls; whole pixels. |

## What check cannot see

These are in the standards and are for the agent to look at, because a static page does not show them:

- **A dialog's behaviour** (ARIA authoring practices): focus moves into it, Tab stays inside, Escape closes it, focus returns to the control
  that opened it. Open it and press.
- **Content on hover or focus** (WCAG 1.4.13): a custom tooltip can be dismissed with Escape, the pointer can move onto it, and it stays
  until the pointer or the focus leaves. The browser's own `title` is exempt; a replacement for it is not.
- **Moving content** (WCAG 2.2.2): an autoplaying or looping picture that lasts more than five seconds beside other content needs a
  way to pause it. Reduced motion is the operating system's setting, and stitch2 checks that it is honoured (reduced-motion), but the
  standard asks for a control on the page.
- **Meaning by colour alone** (WCAG 1.4.1): a status carries a word or a shape.
- **Reading order of a screen reader** (WCAG 1.3.2) beyond what focus-order sees, and the names it speaks (4.1.2).
- **Images of text, captions, audio descriptions** (WCAG 1.2, 1.4.5).
