# Fields: size, shape, labels, placeholders and errors

What a text field, a select or a textarea should be, and why. The numbers and rules come from Material 3, GOV.UK, Atlassian,
Nielsen Norman Group and WCAG 2.2 (see [guides.md](guides.md)); DESIGN.md says how this project draws a field, and the
component carries it once. A rule that a check measures names the check; the rest is for the agent to look at.

## Size

- **Height.** A field is as tall as the button beside it and at least 44px (WCAG's floor is 24px; Apple asks 44pt, Material 48dp
  for a touch target, and its own text field is 56dp). A dense filter row may be shorter on a pointer device, with about 8px of
  space around it **(check: tap-target, tap-spacing)**.
- **Text size on a phone is 16px or more** **(check: field-zoom)**. iOS Safari zooms the page into a field whose text is under 16px, which moves the layout
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
- **A field's focus is its own edge (the Edge Rule).** The edge turns the focus color and a 1px outline joins it at offset 0, so the focus is 2px of
  one line and there is no gap **(check: field-ring-gap)**. A ring 2px off a field stands beside the edge the field draws itself, and the two read as a double
  border. Material thickens the edge of its outlined field to 3px, Carbon draws a 2px outline on the inside of the edge, Primer an inset ring and GOV.UK a 3px
  outline at offset 0 with the border doubled: none of them stands the ring off a field. A button or a link has no edge to take and keeps the ring 2px off, and so
  does a checkbox, a radio or a slider. An invalid field keeps its failure color on focus, as the same 2px. The ring is 3:1 against what it touches (WCAG 1.4.11, 2.4.13).
- **Hover and focus do not fight.** A field under the pointer lights its edge (1px); a focused field is 2px of it, so a click never draws two.

## Label, hint, placeholder

- **A visible label above the field**, short, in sentence case, without a colon (GOV.UK, NN/g). It stays when the field is filled, so a
  person can check the form and an error can be fixed without hunting for what the field was.
- **A placeholder is never the label** **(check: placeholder-label)**, and it does not repeat it: "Password" in a field labelled
  "Password" says nothing. NN/g lists why: it vanishes when typing starts and strains memory, a filled field looks done, it can be taken
  for a value that is already there, not every screen reader reads it, and the browser's grey often fails 4.5:1 **(check: contrast)**.
  If it is kept, it shows an example of the format ("name@example.com") as an addition, in a colour that passes 4.5:1.
- **A hint is text under the label**, one short sentence of up to 90 characters and two lines, tied to the field with `aria-describedby` **(check: hint-length)**,
  with no link in it (a screen reader does not say it is a link) **(check: hint-link)**. Say it without a final full stop (GOV.UK). Three things are why it is short:
  a screen reader reads all of it every time the field takes focus, people read a hint less than the label (DWP), and a long one is a paragraph that wants a place of its
  own. Anything longer goes above the field as ordinary text, or behind a disclosure that opens on a press (never a tooltip: it needs a pointer and hides what most people need).
- **What a hint is for:** the format ("As #RRGGBB"), an example, where to find the value, what the answer is used for, or what an option does. Add one only when there is a
  clear need, and after trying to improve the label (GOV.UK, DWP). It is not general help, not a second label ("Name" over "Your name"), not the field's description in an API
  schema (ids, URLs, "see the docs" belong to the API), and not what the control already shows: a drop area that lists its sizes and lengths does not repeat them in a
  sentence above it. A limit is written once, where the control is.
- **An error takes the hint's place** next to the field and is a message, not a hint (Material, Apple); the hint comes back when it is fixed.
- **Floating labels** are better than a placeholder used as a label, and worse than a label above the field if there is room.
- **Mark the exception.** When almost every field is required, write "(optional)" on the few that are not, rather than a star on all.
- **A value with a form of its own gets the control of that form, not a text box that says the form in its hint.** A color is a swatch that opens the system picker beside the hex, with a clear button where empty means "let the product decide" (Material and Atlassian pair a swatch with a hex field; the native picker is known and accessible), and named chips where the choice is between a few. A date is a date control. A map of words is rows of two fields with a way to add one, never JSON and never lines of `key = value` (the application's own renderer says in a comment that it should be rows, if people ask). A number with a range has its bounds. The hint then does not say the format ("As #RRGGBB"): it says what the value is for. Check the hex when the person leaves the field, say what is valid in the hint's place, and keep what was typed.

## Fields in a row

- **A form is one column.** Baymard's checkout studies and NN/g both find that a second column makes some people skip a field or fill one that is not for them, since the eye is led
  down, and then sideways. Two or three short fields share a line only when they are one thing (a ratio and a length, a city and a postcode) and the rest of the form is one column.
- **A text area and a drop area have the row to themselves** **(check: field-row-wide)**: they are the biggest thing in a form, and a drop area of 190px has no room for its own words.
- **A row has one top** **(check: field-row-align)**. The fields in it have the same parts above their controls: a label and a hint on all of them, or on none. One field with a hint and
  one without start their controls on two lines, and the row looks crooked; the fix is the parts, not a margin.
- **The pane decides, not the window.** A form that sits in a pane of 392px beside a viewer cannot hold two areas because the window is wide: a `sm:` breakpoint measures the window.
  Use the width of the form's own container (a container query, or `auto-fit` with a minimum), so the same form stacks in a narrow pane and sits in two columns in a wide one.

## Errors and validation

- **Say it next to the field, in words and with a mark**, not by red alone: `aria-invalid="true"`, the message tied with `aria-describedby`,
  and on submit the first wrong field gets focus. A summary at the top helps on a long form.
- **An error stands 8px under its control**, the gap that is inside a field (label, hint, control), never flush against it: a message that touches the box it is
  about reads as part of the box.
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

## Submit and what is missing

- **The submit button is not switched off for an incomplete form.** A disabled button says nothing, cannot take focus, is read as broken, and a person may
  not notice when it wakes up (Adam Silver, "The problem with disabled buttons"; Baymard on premature validation). It stays pressable. Pressing it with something
  missing puts the reason next to the field (words and a mark, `role="alert"`, `aria-invalid`, tied with `aria-describedby`), turns the field's edge to the failure
  colour, and moves focus to the first field that needs input. The message goes away the moment the input is there. Disabled is for a form that is busy or already sent, and then it is `aria-busy`.
- **No list of what is missing above the form.** A row of "complete to generate" chips before anyone has typed is noise, and it competes with the button. Say it where the person is looking: at the field, after the press.
- **Every setting has its name above it**, not an icon and "Auto" alone: a picker whose value is "Auto" does not say whether it is the ratio, the length or the model. Icons may stay with a name; they do not replace it.
- **Order follows the task**: what to make, the words, what to base it on, how it is made (settings, rarely changed ones behind "More settings"), then the button. The one line under the button says what the action costs.
- **A long form loses people in three ways**: they cannot see what will happen, they cannot reach the button, and they are told too late what is missing.
  Answer each. The settings are one closed row that says what they are now ("Seedance 2.0 Pro · Aspect ratio: Auto · 720p") and how many differ from the start,
  with a Reset inside; opened, each has its name above it. Never more than two levels of disclosure (NN/g, progressive disclosure): chunk what is left into groups
  that make sense instead of a third level. The button stays in view with its price: a rail that sticks beside a wide form, a bar that sticks to the bottom of a
  narrow one (a sticky element stays inside its parent, so the bar must be a direct child of the whole form). Two or more gaps also make a list at the top, one link
  to each field, and focus goes to the list; one gap needs no list.
- **Keep the person's work.** Ctrl or Cmd with Enter in a long text field presses the button; a draft survives a reload and a sign-up; Clear asks first.

## Disabled and read-only

A disabled field is faint (40%), skipped by the keyboard, and says why nearby. A read-only field stays focusable and keeps its contrast, because
the value is something to read and copy.

## What check does not measure yet

The label wiring and `autocomplete` are for the agent to look at; `check` reports a field under 16px in a phone-sized window (field-zoom), a placeholder that is the
only label, a hint that is long or has a link, a small target, low contrast (a placeholder's too), a state that gives no feedback and a field whose corner differs from the controls beside it.
What a hint says (that it is not the API's words, that it does not repeat the control) is for the agent to read.
