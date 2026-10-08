# Principles for screens that read well

In our own words; the ideas are common practice in interface design, drawn from Refactoring UI (Wathan &
Schoger), Material 3, Apple's Human Interface Guidelines, WCAG 2.2 and the Laws of UX (see
[guides.md](guides.md)); no text is copied from them. Items marked **(check)** are measured by `stitch2 check`;
the rest are judged from the render. Colour names below are roles: the project's DESIGN.md names the actual
colours (its accent, its primary and secondary text, its surface steps).

## Hierarchy

- Decide what matters before styling. Each screen has one focal point and one primary action; everything else
  steps back.
- Emphasise by de-emphasising: make secondary text the secondary colour and a lighter weight rather than making
  the important thing bigger and louder. At most three text styles per region.
- Weight and colour carry hierarchy better than size. A semibold primary-colour label over a smaller
  secondary-colour line reads as a pair; two sizes of the same colour do not.
- Labels are the last resort. A value needs no "Weight:" in front when its card is titled "Body weight"; when a
  label is needed it is the quiet part and the value is the loud part.
- Buttons follow the action's importance, not its existence: one filled primary, secondary on a surface step,
  rare or destructive actions as text or icon buttons.

## Layout and spacing

- Start with too much space and remove it. Crowded is the common failure.
- Use the spacing scale from DESIGN.md; never a value between two steps.
- Spacing shows grouping: the gap inside a group is smaller than the gap between groups. Ambiguous spacing is
  a bug.
- Align to a few vertical lines: the page edge, the card's inner edge, one column for numbers. Numbers in lists
  are right-aligned so their digits line up.
- Fewer borders. Separate with spacing or a surface step first, a hairline second, never a card inside a card.
- Do not fill the width because it is there; prose reads best at about 60 characters a line.

## Type

The full guide is [typography.md](typography.md). In short: every text element is one of DESIGN.md's type
levels **(check)**; hierarchy by weight and colour first; tabular figures on numbers, and large numbers in a
proportional font **(check)**; tracking follows size **(check: capitals)**; wrapped text has room **(check)**;
short labels never wrap **(check)**.

## Colour and depth

- One accent with one meaning ("act here"). Two accent-filled elements in one region: one of them is wrong.
- Greys carry the structure: a few surface steps and two text colours do almost all the work.
- Status colours appear as small text, icons or thin bars, never as large fills.
- Text contrast at least 4.5:1, 3:1 for large text **(check)**. Secondary text on raised surfaces is where this
  fails.
- Depth from surface steps, not shadows; an overlay (sheet, docked bar) may use one soft shadow.

## Data and content

- Real-looking data with irregular numbers. No round placeholders, no "Lorem", no John Doe.
- Show only what the brief describes. Every invented chip, tip, badge, statistic or helper line is a defect.
- Labels that make the described data readable belong in the screen even when the brief does not list them:
  axis or month labels, a legend for a colour scale, captions under figures. They add no new facts.
- Icons that stand for different things look different; one generic glyph repeated down a list says nothing.
- Charts: one series in the accent, thin lines, few gridlines; label a single line directly instead of a legend.
- Empty and loading states are designed too: one sentence and one action; skeletons the size of the content.

## Touch and mobile

- Tap targets at least 44 px for buttons; smaller ones only with spacing **(check)**.
- The primary action sits in the thumb zone (lower half or a docked bar); destructive actions far from it.
- Fixed bars never cover content: the scroll ends with enough bottom padding **(check)**.
- Nothing wider than the frame; only chip rows and tab strips scroll sideways **(check)**.

## Review rubric (step 6)

Score each pass or fail from the render; done when all pass or the failures are explained.

1. **Focal point:** squinting, the eye lands on the thing the user came for.
2. **One primary:** exactly one accent-filled element per region.
3. **Inventory:** everything the brief names is there, nothing it does not name was added, every chart or scale
   carries the labels needed to read it.
4. **Grouping:** spacing alone shows what belongs together.
5. **Alignment:** text starts on a few shared vertical lines; numbers line up.
6. **Type discipline:** every style is a type level (no `type-*` warnings); at most three per region.
7. **Calm structure:** no card in a card, no redundant borders, no decoration without information.
8. **Data realism:** names, numbers and dates look like a real person's data.
9. **Consistency:** built from the catalog components; no `reuse` or `consistency` warnings.
10. **Checks:** `stitch2 check --strict` reports no errors.
