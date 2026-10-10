# Google's design guidance, as rules

Google publishes its app and web design guidance in several places: Material Design 3 and its component
libraries, Android's app quality guidelines, web.dev's Learn Design and Learn Forms courses, and Lighthouse's
audits. This file restates what applies to screens in our own words, with Google's numbers. Rules marked
**(check: name)** are measured by `stitch2 check` (warnings, so a screen can break one on purpose and say why);
the rest are judged from the render. Where Google and DESIGN.md disagree, DESIGN.md wins for the project.

## Layout and window sizes

- **Design for width classes, not devices.** Material and Android group available width into classes:
  compact under 600 px (phones), medium 600–839 (tablets in portrait, unfolded foldables), expanded 840–1199
  (tablets in landscape, small laptops), large 1200–1599 and extra large from 1600 (desktops). A window can
  change class while open (rotation, split screen, a resized browser), so a layout follows the width it has.
- **Order of work:** the compact layout first, then expanded (the most room for change), then decide whether
  medium needs its own layout or takes one of the two.
- **A small screen is not a shrunk large one, and a large screen is not a blown-up small one** (web.dev). On a
  wide window, add columns, panes or a side navigation; do not just widen the phone column.
- **Navigation follows the class:** a bottom navigation bar in compact windows, a navigation rail at the side
  in medium and expanded ones, a drawer (persistent) when there is room for labels and the app has many places.
- **Canonical layouts** (Material): *list-detail* shows both panes side by side from expanded widths and one
  pane at a time below that (narrowing keeps the detail that was open); *supporting pane* puts secondary
  content beside the main one when there is room; *feed* is a grid of cards that adds columns as width grows.
- **Margins:** content keeps 16 px from the window edge in compact windows and 24 px from medium up
  **(check: edge-margin)**. Only deliberate horizontal scrollers (chip rows, carousels) run to the edge.
- **Spacing on a 4 px grid** (Material's 4dp increments): the spacing scale in DESIGN.md should be multiples
  of 4, with 2 px only inside small components.

## Type

- **Material's scale** has fifteen levels in five roles, each in three sizes: display 57 / 45 / 36, headline
  32 / 28 / 24, title 22 / 16 / 14, body 16 / 14 / 12, label 14 / 12 / 11 (sp, at 1x). Titles and labels are
  medium weight, the rest regular. An *emphasized* set adds weight, never size, for selection and headlines.
  Map DESIGN.md's levels onto these roles when choosing sizes; the names can stay the project's.
- **Smallest sizes:** nothing under 11 px (Material's label small), and body text from 12 px up; Lighthouse
  wants at least 12 px for most of a page's text **(check: text-small)**. Prefer 14–16 for reading text.
- **Line length 45–75 characters, in every language the app ships** (Android's app quality guidelines; about
  66 is ideal, per web.dev). Cap prose with a max width in a relative unit, never in pixels: about `32em` lands on
  45–75 characters in most fonts. `ch` is the width of the font's zero, which is wider than an average letter,
  so `66ch` holds 80–90 characters in many sans-serifs **(check: measure)**.
- **Line height** is unitless and follows line length: short lines can take more, long lines less (web.dev).
  Material pairs 16/24 and 14/20 for body.
- **Text resizes:** sizes in rem so the user's font size setting works; the layout still holds at 200%.
- **Few fonts:** every web font file delays text; load what the type levels use and nothing else.

## Touch, pointer and keyboard

- **Touch targets 48 × 48 px** (Material, Android's quality guidelines, web.dev), about 9 mm; an icon of 24 px
  gets padding up to 48. A smaller target needs about 8 px of space to its neighbours: Lighthouse fails a
  target under 48 px when the 48 px square around its centre covers another target **(check: tap-spacing)**.
  WCAG's 24 px floor is checked separately **(check: tap-target)**.
- **Fine pointers** may take smaller targets, but Fitts's law still applies: shrink with care.
- **Do not hide information behind hover.** Hover is optional (touch has none, keyboards focus instead); what
  shows on hover must be reachable without it.
- **Visible focus** on every control, styled with `:focus-visible`, in the order the screen reads
  **(check: focus-visible)**. Material's focus state is a ring plus a light state layer.

## Colour, states and themes

- **Roles in pairs:** text on a colour uses that colour's "on" partner (on-primary on primary, on-surface on
  surface). Depth comes from tonal surface containers (lowest to highest) rather than shadows.
- **Contrast:** 4.5:1 for text under 18 px (14 px bold), 3:1 above **(check: contrast)**. Never colour alone:
  a link also has an underline or weight; a status also has an icon or word.
- **Light and dark:** Android's quality guidelines ask for both themes, and for web content shown in the app
  to follow them (stitch2 checks every theme DESIGN.md defines).
- **States as layers:** hover 8%, focus 10%, pressed 10%, dragged 16% of the content colour over the
  container; disabled content at 38% and its container at 12%. Every interactive component defines them.
- **Shape scale:** corners from a short scale (Material: 4, 8, 12, 16, 20, 28, 32, 48, full). Pick each
  component's corner from DESIGN.md's `rounded` and keep it the same everywhere.

## Components

- **Navigation bar:** three to five destinations, each an icon with a one-line label; more destinations go to a
  rail, a drawer or a page **(check: nav-destinations; label-wraps)**.
- **Button emphasis:** filled for the one main action, tonal or outlined for secondary, text buttons for
  low-emphasis; one floating action button at most.
- **Icon-only controls have a name** that says what they do ("Share", not "Share button"); repeated items in a
  list have different names; decorative icons are hidden from screen readers **(check: unnamed-control)**.
- **Navigation on small screens** (web.dev): with a few links, show them; with many, let them scroll sideways
  (the overflow pattern); hide them behind a toggle only as a last resort, and then label the toggle with a
  word, not only an icon.
- **Carousels** hide content: on small screens show a part of the next item so it reads as scrollable; on
  large screens show a grid. No autoplay.

## Forms (web.dev)

- **Visible labels.** A placeholder is a hint about the format and vanishes while typing; it is never the
  label **(check: placeholder-label)**. Search fields with a search icon are the accepted exception.
- **The right control and keyboard:** `textarea` for several lines, `type="email"`, `tel`, `inputmode="decimal"`
  so phones show the matching keyboard; a control looks like what it does (a link navigates, a button acts).
- **One column, in reading order,** with related fields grouped and 48 px controls with room between them.

## Motion

- **Durations** (Material): short 50–200 ms for small changes (a switch, a ripple), medium 250–400 ms for
  elements entering or expanding, long 450–600 ms for large transitions, up to 1000 ms only for full-screen
  ones. Longer distance or area, longer duration.
- **Easing:** standard `cubic-bezier(0.2, 0, 0, 1)` for movement within the screen; emphasized decelerate
  `(0.05, 0.7, 0.1, 1)` for things entering, accelerate `(0.3, 0, 0.8, 0.15)` for things leaving.

## Responsiveness of the product (for the app, beyond the screens)

- Feedback within about two seconds: a progress indicator or skeleton when content takes longer.
- State survives leaving and coming back (a half-filled form, a running timer); back navigation never loses work.
- Logical properties (start/end) so right-to-left languages mirror; see the stitch2-i18n skill.

## Sources

- Material Components for Android, theming docs (type scale, shape, colour, motion):
  github.com/material-components/material-components-android/tree/master/docs
- Material Design 3: m3.material.io (layout, window size classes, canonical layouts, states, accessibility)
- Android window size classes: developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes
- Android canonical layouts: developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts
- Android core app quality: developer.android.com/docs/quality-guidelines/core-app-quality
- Android adaptive app quality: developer.android.com/docs/quality-guidelines/large-screen-app-quality
- Android accessibility: developer.android.com/guide/topics/ui/accessibility/apps
- web.dev Learn Design (typography, macro layouts, UI patterns, interaction, accessibility, theming,
  internationalization): web.dev/learn/design
- web.dev Learn Forms, design basics: web.dev/learn/forms/design-basics
- web.dev accessible tap targets: web.dev/articles/accessible-tap-targets
- Lighthouse tap targets and font size audits: developer.chrome.com/docs/lighthouse/seo/tap-targets,
  developer.chrome.com/docs/lighthouse/seo/font-size
