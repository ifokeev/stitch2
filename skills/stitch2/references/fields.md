# Fields: size, shape, labels, placeholders and errors

What a text field, a select or a textarea should be, and why. The numbers and rules come from Material 3, GOV.UK, Atlassian,
Nielsen Norman Group and WCAG 2.2 (see [guides.md](guides.md)); DESIGN.md says how this project draws a field, and the
component carries it once. A rule that a check measures names the check; the rest is for the agent to look at.

## Size

- **Height.** A field is as tall as the button beside it and at least 44px (WCAG's floor is 24px; Apple asks 44pt, Material 48dp
  for a touch target, and its own text field is 56dp). A dense filter row may be shorter on a pointer device, with about 8px of
  space around it **(check: tap-target, tap-spacing)**.
- **Text size on a phone is 16px or more.** iOS Safari zooms the page into a field whose text is under 16px, which moves the layout
  and hides the button. The fix is the size, not `maximum-scale=1` or `user-scalable=no`, which also stop people who need to zoom.
  Many systems ship 14px fields; on touch they need `font-size: max(16px, 1em)`. On a pointer device the field takes the page's body size.
- **Width follows the answer.** A postcode, a code or a quantity is short; a name or an address is the width of the column. A field
  as wide as the form for every answer hides how much is expected (GOV.UK sizes a field to its input).

## Shape and edge

- **One radius for everything pressed or typed into.** A button beside a field has the same corner; Atlassian gives buttons, inputs,
  text areas, selects and navigation items one token, Radix and shadcn derive every component from one base radius. Containers take
  the next steps up, and a nested corner is the outer radius minus the padding **(check: radius-mismatch)**.
- **The edge shows where to type.** When the edge is the only thing that says "this is a field", it needs 3:1 against what is next
  to it (WCAG 1.4.11). A filled field on a different surface passes by its fill. The focus ring is separate: one ring, 3:1 against what it touches.
- **Hover and focus do not fight.** A field under the pointer may light its edge; a focused field shows the ring alone, so a click never
  draws two.

## Label, hint, placeholder

- **A visible label above the field**, short, in sentence case, without a colon (GOV.UK, NN/g). It stays when the field is filled, so a
  person can check the form and an error can be fixed without hunting for what the field was.
- **A placeholder is never the label** **(check: placeholder-label)**, and it does not repeat it: "Password" in a field labelled
  "Password" says nothing. NN/g lists why: it vanishes when typing starts and strains memory, a filled field looks done, it can be taken
  for a value that is already there, not every screen reader reads it, and the browser's grey often fails 4.5:1 **(check: contrast)**.
  If it is kept, it shows an example of the format ("name@example.com") as an addition, in a colour that passes 4.5:1.
- **A hint is text under the label**, one short sentence, tied to the field with `aria-describedby`, with no link in it (a screen reader
  does not say it is a link). Anything longer goes above the field as ordinary text.
- **Floating labels** are better than a placeholder used as a label, and worse than a label above the field if there is room.
- **Mark the exception.** When almost every field is required, write "(optional)" on the few that are not, rather than a star on all.

## Errors and validation

- **Say it next to the field, in words and with a mark**, not by red alone: `aria-invalid="true"`, the message tied with `aria-describedby`,
  and on submit the first wrong field gets focus. A summary at the top helps on a long form.
- **Say what to do**: "Enter your email address", "Email must look like name@example.com", "Full name must be 2 characters or more".
- **Check when the person has finished the field** (on blur), not on every key. A new password or a free username is the exception: show the
  rule or the result while typing (NN/g). Keep what was typed when it is wrong, and let people paste.

## Autofill and keyboards

- **Name the purpose** with `autocomplete` on every field about the person: `email`, `name`, `username`, `current-password`, `new-password`,
  `one-time-code`, `tel`, `postal-code` (WCAG 1.3.5). `type` says only the kind of data.
- **Show the right keyboard**: `type="email"`, `tel`, `url`; `inputmode="numeric"` for a whole number and a code; `autocapitalize="none"` and
  `spellcheck="false"` for an address, a username and a code.
- **Passwords** can be shown on request and can be pasted into. `autofocus` belongs to a dialog or a page with one job: elsewhere it opens the
  keyboard over the page on a phone.

## Disabled and read-only

A disabled field is faint (40%), skipped by the keyboard, and says why nearby. A read-only field stays focusable and keeps its contrast, because
the value is something to read and copy.

## What check does not measure yet

The 16px text on touch, the label and hint wiring, and `autocomplete` are for the agent to look at; `check` reports a placeholder that is the only
label, a small target, low contrast (a placeholder's too), a state that gives no feedback and a field whose corner differs from the controls beside it.
