---
version: alpha
name: gymgym
description: Dark training instrument for the gym floor. Charcoal surfaces, chalk type, one Ember accent.
colors:
  primary: "{colors.ember}"
  floor: "#0F0F11"
  iron: "#18181B"
  raised: "#232327"
  hairline: "#2E2E33"
  chalk: "#F4F4F5"
  steel: "#A1A1AA"
  faint: "#71717A"
  ember: "#E8662C"
  ember-pressed: "#D2591F"
  ember-wash: "rgba(232, 102, 44, 0.14)"
  success: "#3FB27F"
  warning: "#E5B54A"
  danger: "#E5484D"
  paper: "#F3F3F3"
  light-floor: "#F6F6F4"
  light-iron: "#FFFFFF"
  light-raised: "#EFEFEC"
  light-hairline: "#E4E4E0"
  light-chalk: "#18181B"
  light-steel: "#5F5F68"
  light-faint: "#8E8E96"
  light-ember: "#BC4C18"
  light-ember-pressed: "#A9440F"
  light-ember-wash: "rgba(232, 102, 44, 0.12)"
  light-success: "#237A53"
  light-warning: "#8F6810"
  light-danger: "#D23C41"
  light-paper: "#F3F3F3"
typography:
  display-timer:
    fontFamily: Geist
    fontSize: 56px
    fontWeight: 600
    lineHeight: 56px
    letterSpacing: -0.04em
    fontFeature: '"tnum" 1'
  display-stat:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: 600
    lineHeight: 44px
    letterSpacing: -0.04em
    fontFeature: '"tnum" 1'
  title-screen:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: 600
    lineHeight: 34px
    letterSpacing: -0.03em
  title-sheet:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: -0.02em
  number-set:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: 500
    lineHeight: 28px
    letterSpacing: -0.02em
    fontFeature: '"tnum" 1'
  title-card:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: -0.02em
  body:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: 0em
  body-strong:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0em
  label-button:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0em
  meta:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: 0em
  meta-number:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: 0em
    fontFeature: '"tnum" 1'
  label-chip:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0em
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0.06em
  caption:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0.01em
  label-tab:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: 500
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 8px
  input: 12px
  btn: 14px
  row: 16px
  card: 20px
  sheet: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  page: 16px
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.floor}"
    typography: "{typography.label-button}"
    rounded: "{rounded.btn}"
    height: 48px
    padding: 20px
  button-primary-pressed:
    backgroundColor: "{colors.ember-pressed}"
  button-primary-disabled:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.faint}"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.chalk}"
    typography: "{typography.label-button}"
    rounded: "{rounded.btn}"
    height: 48px
    padding: 20px
  button-secondary-pressed:
    backgroundColor: "{colors.hairline}"
  chip:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.steel}"
    typography: "{typography.label-chip}"
    rounded: "{rounded.full}"
    height: 32px
    padding: 12px
  chip-selected:
    backgroundColor: "{colors.ember-wash}"
    textColor: "{colors.ember}"
  segment:
    backgroundColor: "{colors.floor}"
    textColor: "{colors.steel}"
    typography: "{typography.label-chip}"
    rounded: "{rounded.sm}"
    height: 36px
  segment-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.chalk}"
  tab-item:
    textColor: "{colors.steel}"
    typography: "{typography.label-tab}"
  tab-item-active:
    textColor: "{colors.ember}"
  input:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.chalk}"
    typography: "{typography.body}"
    rounded: "{rounded.input}"
    height: 48px
    padding: 14px
  set-row:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.chalk}"
    typography: "{typography.number-set}"
    rounded: "{rounded.row}"
  set-row-ticked:
    backgroundColor: "{colors.ember-wash}"
  card:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.card}"
    padding: 16px
---

# Design System: gymgym

## Overview
A focused training instrument for the gym floor: dark, calm and legible at arm's length with sweaty hands and
bad lighting. Density "Daily App Balanced" (5/10): one clear job per screen, the next action always obvious.
Variance 4/10: predictable app structure (top title, content stack, bottom tab bar) with confident, slightly
offset typographic hierarchy. Motion 4/10: short, weighty transitions only where they confirm an action
(a set ticked, a rest timer running). The mood is a well-kept strength gym at night: charcoal surfaces,
chalk-white type, and one warm signal colour that means "do this now".

## Colors
- **Charcoal Floor** (floor #0F0F11): app background. Never pure black.
- **Iron Surface** (iron #18181B): cards, sheets, the bottom tab bar.
- **Raised Iron** (raised #232327): inputs, steppers, chips, pressed rows.
- **Hairline** (#2E2E33): 1px dividers and card borders.
- **Text in three levels.** Chalk (#F4F4F5) for titles, values and anything the user acts on; Muted Steel
  (steel #A1A1AA) for secondary lines, labels and metadata; Faint (#71717A) only for disabled controls and for
  separators such as "·". Faint is below 4.5:1 on our surfaces, so it never carries information.
- **Ember** (#E8662C): the single accent: primary buttons, the active tab, the running rest timer, today's day,
  ticked sets, focus rings. At most one Ember-filled element per screen region. Pressed: #D2591F.
- **Ember Wash** (rgba(232,102,44,0.14)): background of ticked set rows and selected filter chips.
- **Status:** Success #3FB27F (records, goal reached), Warning #E5B54A (lagging lift, offline), Danger #E5484D
  (delete, failure-effort rating). Status colours appear only as small text, icons or thin bars, never as large fills.
- Effort scale (RIR/RPE chip): Danger #E5484D (all-out) → half Danger, half Warning → Warning #E5B54A → Success
  #3FB27F → Muted (easy).
- **Paper** (#F3F3F3): only behind exercise illustrations, which are drawn on it; the same in both themes.
- Light theme: the `light-*` colours, the same roles; its Ember is darker (#BC4C18) to keep 4.5:1 as text on the light background and on white, and for the light label on Ember buttons.

## Typography
Geist everywhere, at three weights: 400 for reading, 500 for names and values, 600 for titles, buttons and
caps labels. The fifteen levels in the front matter are the only text styles; each one fixes size, line
height, weight and tracking together, so pick a level, never a size.

- **Hierarchy comes from weight and colour before size.** Most of a screen is 13–15px; one or two elements
  per screen are large (the title, and the number the screen is about).
- **Tracking follows size**, as Geist's own scale does: titles are tightened (−0.02em at 18–22px, −0.03em at
  28px, −0.04em at 40px and up), reading sizes are 0, and small text opens slightly (caption +0.01em, tab labels
  +0.02em, caps labels +0.06em).
- **Numbers** use tabular figures so columns and timers never jitter. Large values (set rows, stats, timers)
  are Geist with tabular figures: its decimal point stays narrow, where Geist Mono's would leave "80 . 7" gaps.
  Geist Mono is for small numeric metadata that stands on its own (`meta-number`: "55 min · 14 sets" in a
  right-hand column, "4 Oct"); a number inside a sentence stays in the sentence's font with tabular figures.
  Units sit next to their value in Steel at about half its size ("82.5" number-set with "kg" caption; "80.7"
  display-stat with "kg" title-card).
- **Caps** only in `label-caps` section labels, never in titles or buttons, and never for scripts without case
  (Chinese, Korean, Thai, Hindi, Arabic), where caps labels use `label-chip` instead.
- **Languages.** Arabic, Thai, Hindi, Chinese and Korean take no letter-spacing (it breaks Arabic joining and
  looks broken in the others); Thai and Hindi need at least 1.5 line height. Labels must survive German and
  Russian text about 30% longer than English: they truncate with an ellipsis or the layout gives them room.
- Body text lines stay under 60 characters in sheets and hints. Banned: Inter, serifs, all-caps headlines,
  gradient text, weights 300 and 700+.

## Layout
- Mobile first, 390px wide reference. 16px side padding, 24px between sections, 12px between items inside a
  card, 16px card padding.
- Screen structure: title row (title left, one or two icon buttons right), then a vertical stack of sections, then
  the fixed bottom tab bar with safe-area padding.
- Desktop (≥1024px): a left sidebar replaces the tab bar; content max-width 960px; stats can use a two-column grid.
- Touch targets at least 44px; the tick button 48px. Nothing overlaps; no horizontal page scroll (chip rows may scroll).

## Elevation & Depth
Depth comes from tonal layering: Floor recedes, Iron cards step forward, Raised Iron controls sit on top, with
1px Hairline borders where two surfaces meet. No drop shadows on cards; a sheet or docked timer may cast one
soft shadow to separate it from the content scrolling beneath.

## Shapes
Rounded but firm: 8px small controls, 12px inputs, 14px buttons, 16px set rows, 20px cards, 24px sheet tops,
pills for chips and the Start circle. Never mix sharp and rounded corners in one view.

## Components
- **Buttons:** 48px tall, 14px radius, `label-button`. Primary: Ember fill, Charcoal Floor text. Secondary:
  Raised Iron fill, Chalk text. Danger: transparent with Danger text and hairline border.
- **Set row (the core component):** One row per set on Raised Iron, 16px radius: set number (or W/D/RP for
  warm-up, drop, rest-pause) on the left, then the weight and the reps in `number-set`, and on the right an effort
  chip over a 48px tick button. A ticked row turns Ember Wash with an Ember tick. The active set adds a second line:
  a − and a + button (44px tall, side by side on Floor) under its weight and under its reps, so values stay in
  their columns whatever their length. A header over the table names the columns: Set, the unit, Reps and the
  effort scale (RPE or RIR).
- **Cards:** Iron Surface, 20px radius, 1px Hairline border, no shadow. Used for the today card, stats blocks
  and lists; inside a card use hairline dividers, never cards in cards.
- **Chips:** 32px tall pills on Raised Iron, Steel `label-chip`; a selected filter is Ember Wash with Ember text.
- **Segmented controls:** a Floor track with Raised Iron for the selected segment, Steel text turning Chalk
  when selected. Neutral on purpose: Ember stays free for the region's one action.
- **Bottom tab bar:** Iron Surface with a top hairline, 64px tall, five items (Home, Plan, Start, Exercises,
  Stats), each a 22px outline icon over a `label-tab` label; the active item is Ember (icon and label, same
  weight, never a filled icon). The centre item is a 56px Ember circle with a play icon, raised 28px above the
  bar, with its own "Start" label below like the others; it reads "Resume" while a workout runs.
- **Sheets:** Bottom sheets with a grab handle, 24px top radius, used for exercise details, pickers and editing.
- **Inputs:** Label above, Raised Iron fill, 12px radius, Steel placeholder, Ember focus ring 2px.
- **Charts:** Thin 2px lines, Ember for the main series, Muted Steel gridlines at 30% opacity, `caption` axis
  labels. Label what is needed to read the chart (axis months, a less-to-more legend), nothing more.
- **Body map:** Front and back figure, untrained muscles Raised Iron, trained muscles shaded in Ember by volume.
- **Empty states:** One sentence of guidance and one action, no illustration clutter.
- Icons: Lucide, 1.75px stroke, 20px.
- **Affordance icons:** a row or card that opens something ends in a 16px Steel chevron; a primary button may
  lead with an icon that names its action (play for Start). Icons never replace a label.

### States (every interactive element shows them)
- **Pressed:** buttons and rows move down 1px and darken one step (Ember → #D2591F, Raised → Hairline);
  circular buttons scale to 0.95. Feedback within 100ms.
- **Hover (pointer devices only):** Steel text and icons turn Chalk; surfaces lighten one step.
- **Focus (keyboard):** 2px Ember ring with 2px offset in the Floor colour. Never remove it without a replacement.
- **Selected:** filter chips Ember Wash + Ember text; segments Raised + Chalk; the active tab Ember icon and label.
- **Disabled:** Faint text and icons on Raised, no pressed or hover change, and the reason shown nearby when it is
  not obvious.
- **Error:** Danger border on the field and one `meta` line in Danger under it saying how to fix it.

## Do's and Don'ts
- Do build every screen from the shared components (the component catalog); when a screen needs something
  slightly different, adapt the content or extend the component for every screen. Don't restyle a component
  on one screen or build a near-copy of it.
- Do use Ember only for the single most important action in each region.
- Do pick text styles from the type levels; don't invent sizes between them.
- Don't use emojis, purple or neon, glows, glassmorphism or gradients behind text.
- Don't use pure black or more than one accent colour.
- Don't put a centred marketing hero inside the app or a row of three equal cards.
- Don't use stock photos of models or motivational slogans ("Crush it", "Beast mode").
- Don't use generic placeholder names (John Doe, Acme) or fake round numbers.
- Don't use circular spinners: show skeleton rows the size of the content.

## Motion & Interaction
- Ticking a set: the row fills with Ember Wash and the tick scales 0.9→1 (150ms spring).
- The rest timer counts down with a thin Ember progress bar draining; at zero the screen briefly flashes Ember.
- Sheets slide up 220ms; lists appear without staggered animations (speed matters between sets).
- Animate only transform and opacity.

## Content & Voice
Short, plain, second person. Real training data in mock-ups: "Push day", "Barbell Bench Press 80 kg × 5",
"Back Squat 120 kg × 5 · RPE 8", body weight "80.7 kg", streak "4 weeks". Names like Ivan, Maria, Demo.

## Layout Guardrails
- The bottom tab bar is fixed; the scrolling content ends with bottom padding of at least 120px (224px on the
  workout screen, which also docks the rest timer) so the last row and button are fully visible above it. The
  docked rest timer sits clear of the raised Start circle (6rem plus the safe area above the screen bottom); no
  two fixed elements ever overlap.
- The tab bar has exactly five items in this order: Home, Plan, centre Ember circle (Start, or Resume during a
  workout), Exercises, Stats. Never Workout, History, Profile, Settings or a hamburger menu in the tab bar, and no
  navigation bar or menu in the header; a header may carry History or Settings icon buttons when the screen's
  description asks for them.
- Screen headers: the title sits fully inside the screen with 16px top padding below the safe area, on one line.
  Metadata under a title (elapsed time, set count, dates) stays on one line: short text, whitespace-nowrap.
- Chips, segmented controls and buttons never wrap their label onto two lines. Range selectors use short labels:
  "30d", "90d", "1y", "All".
- Set rows use a fixed four-column grid: 28px set label | 1fr weight | 1fr reps | 48px right column. The right
  column stacks a 48×24 effort chip with the value only ("8.5", "10", or "–" when unrated; the header names the
  scale) above the 48×40 tick button. − and + never share a line with a value: in the active set they sit on the
  line below, under the value they change.
- No keyboard-shortcut hints (⌘K), no desktop affordances on mobile screens, no invented section labels such as
  "Primary results" or "curated".
- Every element fits within 390px: no clipping, no overlap, no horizontal page scroll (chip rows may scroll).
- Mock-ups show only what the app shows: no phone status bar (time, signal, battery), no step or flow labels
  ("Step 2 of 3"), no tip, promo or explainer cards, and no helper text under fields or settings unless the
  screen description asks for it. Never invent features or buttons the description does not mention.
