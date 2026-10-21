# Screens, versions and approval

The canvas and the agents share one model: an app **screen** (home, settings, …) has **versions**, design
iterations numbered v1, v2, v3…, and each version has **variants**, its layouts for each device (mobile,
desktop, later tablet). Each variant has a **status**. The user decides; agents read the decision
and build on it. Meta tag names below use the project's prefix (`<p>`, from `stitch2.config.json`).

## Names and files

- Screen names are lowercase with hyphens and name what the user sees; one per step of a flow
  (`checkout-1`, `checkout-2`). Reuse existing names (`stitch2 screens` lists them).
- A variant is one file, `<screens dir>/<screen>/<device>-v<N>.html`; the variants of a version share N
  (`mobile-v3.html` and `desktop-v3.html` are v3). A new version takes the next free N across the screen's
  variants; a variant added to an existing version takes that version's N (a desktop for v3 is
  `desktop-v3.html`, never v4). A version may start with one variant and get the others later.
  Its head carries `<p>-screen`, `<p>-page` (see Pages), `<p>-device` (mobile | desktop), `<p>-status`, `<p>-source` (stitch | lab | app),
  `<p>-frame-width` (390 mobile, 1280 desktop) and, written by the user, `<p>-note`. Older files elsewhere
  carry the same tags.

`<p>-frame-height` optionally sets the viewport height the design was drawn at (default 844 px).
It is not the document height: long pages still appear whole. In canvas frames and their pictures,
`vh`, `svh`, `dvh` and `lvh` keep this viewport height when the frame grows, so full-height sections
do not create ever-growing gaps. Width responsiveness stays active.

`source=app` means an unchanged capture of a running application's rendered DOM,
not a hand-authored design. Layout and visual checks still apply; the `reuse`
rule does not demand replacing its already-rendered framework components with
lab elements. Keep the import URL as provenance. A new design based on a capture
uses `source=lab` and the shared component catalog, not the snapshot exception.

## Pages and their screens

A place in the app often has several states or steps: the workout with its number pad, its menu and its discard
question; an exercise list with its detail sheet and a three-step form. Each is a **screen** of its own (it has its own
versions and approval), and they belong to one **page**: `<p>-page` in the head, the page's name (`workout`). The page's
main screen has the page's name; the others are named `<page>-<state>` (`workout-entry`, `workout-menu`,
`create-exercise-1`) and carry the same `<p>-page`. The canvas folds a page's screens under its name and lays them out
together; `stitch2 screens <page>` lists them. A screen without `<p>-page` is a page of its own.

- A new state of an existing place (a sheet, a dialog, an empty, loading or error state, a step) is a new screen in
  that page, not a new page.
- Copy `<p>-page` along with the other tags into each new version; the latest version that has it decides the page.

## Empty, loading and error

Every page that shows data has these states, and the app shows them on most first visits: a new user sees the
empty screen before any other, and every user sees the loading one. Design them with the page's main screen,
not after it.

- **Which pages:** any page that lists, counts or charts the user's data, or loads it from a server. A form, a
  dialog, a static page (sign-in, a landing page) needs none; say so in the hand-over.
- **Names:** `<page>-empty` and `<page>-loading` (`history-empty`, `history-loading`), `<page>-error` when it
  has one, with the page's `<p>-page`. Same version number and same variants (mobile, desktop) as the main
  screen. A page whose main screen is a new version gets new versions of its states when they change.
- **Empty:** the page's header and navigation stay where they are. In place of the content: what this place is
  for in one sentence, and the one action that fills it ("Create your first routine"). Use the page's own
  components where they help (a suggested program as a list row), not a large illustration. An empty search or
  filter result is a different empty: it says nothing matched and how to widen it (clear the filter), and keeps
  the search field and filters.
- **Loading:** the same layout as the main screen, with skeletons in place of the data: blocks the size and
  shape of the rows, cards and numbers that will arrive (typography.md, Text in each state). The header,
  navigation and buttons that need no data stay real and usable. No spinner in the middle of the page and no
  "Loading…" text; a spinner belongs only inside a button or a row that is saving. Build skeletons from a
  catalog component, so every page loads the same way.
- **Error:** the page's frame stays; where the data would be, one sentence on what failed and a Retry action.
  Data already shown stays on screen; a failed save says so next to what failed and keeps the user's input.
- **Partial states** follow the same rules inside a section: an empty list in a page that has other data shows
  one line and an action in that section only.

## New version or edit?

- **New version** for every new attempt: a new direction, a regeneration, an export from a generator, a
  redesign after feedback on an approved screen. It starts as `draft` and ends as `review`.
- **New variant** for a device the version lacks (its desktop, its tablet): a new file with the version's N,
  `draft` then `review`, even when the version's other variants are approved.
- **Edit in place** only to finish your own draft, or to answer a note on a version still in `review` or
  `draft`.
- **Never edit** an `approved` or `archived` variant: copy the version to the next number and change the copy.
  The exception is the user's own request: a fix they ask for on a version they name ("it had to be on v3")
  goes into that version, which keeps its status; say what changed.

## Statuses

| Status | Meaning | Who sets it |
|---|---|---|
| `draft` | Work in progress | The agent, while working |
| `review` | Finished, waiting for the user ("Needs review") | The agent, when done |
| `approved` | The current version: the reference to build on and match, and the only one the app implements | The user only (on the canvas, or in words: then the agent runs `stitch2 approve`) |
| `archived` | Outdated: superseded or rejected; hidden on the canvas | Approval: approving a variant archives every earlier version of that screen on that device, whatever its status |

**One current version.** For each screen and device there is at most one approved variant, and it is what the app
shows. Approving one archives every earlier version there (approved, in review or a draft), so nothing older can be
mistaken for the current one; a later version, a newer proposal, keeps its status. `stitch2 screens` ends with
anything that breaks this (two approved, an older version still in review); `--strict` fails on it.

The canvas shows each version with its variants side by side under one heading, and one status for the version:
needs review while any variant does. **Approve version** approves every variant in review at once; a single
variant can still be approved, archived or noted on its own.

## Links between screens

A screen that embeds or points at another screen names its file
(`src="/screens/workout/mobile-v3.html"`): always the current approved version of that screen on that
device, never a previous one. Approving a variant moves every such link to it at once (the canvas Approve
does the same as `stitch2 approve`), and `stitch2 screens` lists any link that still names a previous variant
— fix it, or move it to the current version yourself when the link was deliberate. A link to a version still
in review or a draft is a preview of a proposal and stays.

## How to use them

1. Before designing, run `stitch2 screens` (a name or `--status approved` narrows it) and open the approved
   versions of the screens next to yours.
2. A note is the user's feedback: address every point in your next version or edit, and say how.
3. Never approve on your own and never build on an archived version unless asked. When the user approves in words
   ("approve the v3 screens"), run `stitch2 approve <path or filter…>` rather than editing status tags: it archives the
   earlier versions as the canvas does.
4. **Implement only approved versions.** A version in review or a draft is not built in the app, not even partly. If
   the user asks to implement one that is not approved yet, that request is their approval: run `stitch2 approve` on it
   first and say so. If the app needs something no approved version shows, design it and hand it over first.
5. When the user pastes a reference copied from the canvas, such as `home mobile v2
   (design/screens/home/mobile-v2.html)`, open that file: it names exactly the version they mean.
6. A reference to an element adds its source line, its tag and its text: `home mobile v1
   (design/screens/home/mobile-v1.html:36) <gg-button> “Start Push”`. The element is the one with that tag
   starting on that line (the text tells apart two on one line); a component's tag stands for everything it
   renders. Change that element, or the component itself when the change belongs on every screen. Several
   references in one message are numbered in the order the user picked them.

## Implementing an approved version

Check first with `stitch2 screens <screen>` that the version is approved and is the only approved one on its device. Build the screen in the app from the same components the screens use, in the version's order, with the app's
own data, strings and behaviour; keep the app's tests passing. Then run `stitch2 compare <screen>` with the app
running: fix every `missing` component and look at the side-by-side report. `extra` and `order` warnings are
fine when the app needs them (a desktop-only control, a frame drawn by layout); say so when you hand over. When
the page needs a state first (an open sheet, a running workout), add a `prepare` module for its route.

## Desktop

Desktop is a variant of a version, designed after the version's mobile variant is approved: `desktop-v<N>.html`
with the mobile's N, frame width 1280, the same components and type levels, the layout from DESIGN.md (typically a sidebar instead
of a tab bar, a content max width, two columns where it helps). Shared components get their desktop form in the
component, before the first desktop screen.

## Widths

A variant is drawn at one frame width but covers a range of windows: `widths` in `stitch2.config.json`, by
device, `[narrowest, widest]` in px. The defaults follow Google's window size classes ([google.md](google.md)):
mobile 360–599 (compact), tablet 600–1023 (medium), desktop 1024–1920 (expanded and up); a project sets the
width where its app actually changes layout (gymgym: mobile up to 1023, desktop from 1024).

Widths are a dimension like themes and languages, not more files: `stitch2 check` also renders every variant at
both ends of its range and reports what breaks there ("at 1024px: …"), and the canvas shows every frame at its
narrowest or widest (the width dropdown, W).

Inside a range the layout changes at the project's **breakpoints** (`breakpoints` in the config, Tailwind's by
default: sm 640, md 768, lg 1024, xl 1280, 2xl 1536). Each one starts a layout at its narrowest, where it is most
likely to break, so check also renders every variant at each breakpoint inside its range (gymgym's mobile variant
at 360, 640, 768 and 1023). On the canvas, "At 768 px (md)" shows every screen at that window; a variant that
doesn't cover it is drawn at its nearest edge and faded, because the app shows another variant there.

- Design for the whole range, not only the frame: a phone layout stretched to 1023 px with a 390 px column in the
  middle of the window is a defect at that width. Let it use the room (two columns of cards, a wider measure
  capped by the type rules) or give the range to a new variant.
- Use the breakpoints the config names and no others (no `min-[700px]:`), so check covers every layout the
  screen has.

- A screen that breaks at an edge gets a **responsive rule inside the same variant**: a two-column grid that drops
  to one, three cards across that become two, a side column that moves under the main one. Use the project's
  breakpoints (Tailwind's `md:`, `lg:`, `xl:`), so the screen keeps one layout that adapts.
- Only when the **structure** has to change (a bar becomes a side navigation, one pane becomes list-detail) is it a
  new variant: `tablet-v<N>` for 600–1023, with its own frame width (768) and range, the same N as the version.
- A desktop screen is a layout for its range, not a stretched phone: a side navigation instead of the bar,
  list-detail with both panes, extra columns for feeds.

## App states

When the product looks different signed in or out, on another plan or for another role, do not draw a copy of each
screen per state. Draw it once, let its CSS and scripts answer to an attribute on `<html>`, and list the states as
`modes` in `stitch2.config.json`:

```json
"modes": [
  { "name": "auth", "label": "Account", "values": [{ "value": "guest", "label": "Guest" }, { "value": "user", "label": "Signed in" }] }
]
```

The canvas sidebar then has a dropdown for each mode. A value sets the attribute (`data-auth="user"`; `attribute`
names another) on every screen, live frames and the pictures of the rest, and "As drawn" puts each screen back to what
its file says. `m` cycles the first mode. A screen is still written for the state it shows (a signed-in account page has
`data-auth="user"` in its file); modes show the other states of the same screen. `stitch2 check` runs on the screens as
drawn, not in each state, so open the other states on the canvas and look at them before hand-over.

## The canvas

`stitch2 canvas` → http://localhost:4400. The sidebar lists DESIGN.md (drawn as tokens and rules), Components
(the catalog for the variants the filter shows; a click steps through them), the consistency report and app
comparison (each with when it last ran, or how many covered screens changed since), Languages, and every screen
with its versions. Filters: status (active, approved, needs review, all), versions, variants, theme, width,
language and each app state (`modes`). The reports and Languages follow the filters too: they show only the screens the canvas shows. Selecting a version opens the inspector: status, note, checks, and
Copy for its reference. Pick mode (`p`) highlights the element under the pointer; a click copies its reference,
Shift-click collects several (Copy all, Add to note). Keys: `/` search, `j`/`k` next and previous, `a` approve,
`p` pick, `f` fit, `m` next app state, `0` actual size, double-click to use a frame, `Esc` to leave.
