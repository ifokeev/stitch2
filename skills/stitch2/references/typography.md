# Typography for app screens

Most of what makes a dense app screen look finished is type: a small set of text styles used the same way
everywhere, hierarchy carried by weight and colour, tracking that follows size, quiet secondary text. The
project's DESIGN.md defines the levels (front matter `typography`); `stitch2 tokens` turns each into a
`.type-<level>` class, `stitch2 check` warns about text that is not one of them, and `stitch2 type` lists every
style a screen uses.

## 1. A type scale is a short list of levels

Google's DESIGN.md format suggests 9–15 levels, each fixing family, size, line height, weight and tracking
together. A typical app set (sizes for a 390 px phone):

| Role | Typical size / line | Weight | Tracking |
|---|---|---|---|
| Display (a timer, a hero number) | 40–56 / 1.0–1.1 | 600 | −0.04em |
| Screen title | 28 / 34 | 600 | −0.03em |
| Sheet or dialog title | 22 / 28 | 600 | −0.02em |
| Card title | 18 / 24 | 600 | −0.02em |
| Body | 15–16 / 22–24 | 400 | 0 |
| Body strong (list names) | 15 / 20 | 500 | 0 |
| Button label | 15 / 20 | 600 | 0 |
| Meta (secondary lines) | 13 / 18 | 400 | 0 |
| Chip or tab label | 13 / 16 | 500 | 0 |
| Caps label (sections) | 12 / 16 | 600 | +0.06em, uppercase |
| Caption (units, axes) | 12 / 16 | 400 | +0.01em |
| Tab bar label | 11 / 14 | 500 | +0.02em |

- One `.type-<level>` class per text element plus a colour class. No size, weight, tracking or line-height
  utilities on text: that is how screens drift into twenty slightly different styles.
- Add a level only when a real use appears on two screens and nothing fits. Never solve a one-off with an
  in-between size.

## 2. Hierarchy recipes

| Element | Recipe |
|---|---|
| Screen header | meta line in the secondary colour above the screen title |
| Section | caps label, 8 px above its block |
| Card header | data cards: a caps label; cards whose title is the content: a card title |
| List row | body-strong name over a meta line; a trailing value as meta, or body-strong when it matters |
| Stat | caps label, a large value with its unit at about half its size in the secondary colour, a meta note |
| Controls | button label on buttons, chip label on chips and segments, tab label in the tab bar |

At most three levels and two text colours per region. Most of a screen is 13–15 px; one or two things are big.
To make something stand out inside a row, change its weight or colour, not its size.

## 3. Text colour

- Primary text for what the user reads first or acts on; secondary for everything else; a third, faint grey
  only for disabled text and separators (it usually fails 4.5:1, so it never carries information).
- Accent-coloured text means "active" or "act here". Check its contrast on every surface it sits on: accent text
  on a tinted accent background over a raised surface is a common failure.
- Status colours colour short values and words, never sentences.

## 4. Numbers

- Tabular figures for every number, so columns line up and timers do not jitter.
- Large values in a proportional font with tabular figures: monospace fonts give the decimal point, comma and
  colon a full-width cell ("80 . 7"); `check` warns about large monospace numbers. Monospace, if the brand uses
  it, is for small standalone metadata, never mid-sentence.
- Units follow their value at about half its size in the secondary colour.
- Real typography: minus "−" for negatives, "×" for multiplication, en dash for ranges, "·" between facts.
- Locales write numbers differently ("82,5"): leave room and never hard-code the decimal point.

## 5. Tracking and line height

- Tracking follows size: tight for titles (tighter the bigger), zero for reading sizes, open for small text and
  capitals. For fonts without optical sizes (Geist, Inter and most web fonts) the font's own scale is the best
  guide; Apple's SF Pro table follows the same curve below 24 pt.
- Line height comes with the level. Wrapped text needs at least 1.3× its size; `check` reports wrapped text under
  1.15× as an error. A line height equal to the size is only for single-line display numbers.
- Titles, labels and metadata stay on one line: truncate with an ellipsis rather than wrap.

## 6. Capitals

Only the caps-label level: one to three words, never buttons, titles or sentences. Chinese, Korean, Thai, Hindi
and Arabic have no capitals; `tokens.css` removes the uppercase and tracking for those languages.

## 7. Text in each state

| State | Text |
|---|---|
| Hover (pointer only) | secondary → primary colour |
| Pressed | unchanged; the surface darkens and moves 1 px |
| Focus | unchanged; a visible ring around the control |
| Selected | the accent (chips, tabs) or primary text on a raised surface (segments) |
| Disabled | the faint colour, with the reason nearby when it is not obvious |
| Error | one meta line in the danger colour under the field, saying how to fix it |
| Placeholder | secondary colour, an example of the input, not an instruction |
| Loading | skeleton bars the height of the level's line |

## 8. Length and languages

Translations run up to 30% longer (German, Russian, Polish, Hungarian): every label has room or truncates.
Right-to-left scripts align to start and end, never left and right, and are never letter-spaced (it breaks
Arabic joining). Thai and Hindi need line height of at least 1.5. Latin web fonts lack Arabic, CJK, Thai and
Devanagari; `tokens.css` falls back to Noto and system fonts.

## 9. Type review

1. `check` shows no `type-*` warnings.
2. Squint: the title and the screen's main number are the only big things.
3. Secondary text differs by colour and weight, not just size.
4. Numbers are tabular; large ones proportional; units smaller and secondary.
5. At most three levels per region; capitals only in section labels; nothing wraps that should not.
