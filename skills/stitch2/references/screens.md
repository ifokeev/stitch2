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
  Its head carries `<p>-screen`, `<p>-device` (mobile | desktop), `<p>-status`, `<p>-source` (stitch | lab),
  `<p>-frame-width` (390 mobile, 1280 desktop) and, written by the user, `<p>-note`. Older files elsewhere
  carry the same tags.

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

- A screen that breaks at an edge gets a **responsive rule inside the same variant**: a two-column grid that drops
  to one, three cards across that become two, a side column that moves under the main one. Use the project's
  breakpoints (Tailwind's `md:`, `lg:`, `xl:`), so the screen keeps one layout that adapts.
- Only when the **structure** has to change (a bar becomes a side navigation, one pane becomes list-detail) is it a
  new variant: `tablet-v<N>` for 600–1023, with its own frame width (768) and range, the same N as the version.
- A desktop screen is a layout for its range, not a stretched phone: a side navigation instead of the bar,
  list-detail with both panes, extra columns for feeds.

## The canvas

`stitch2 canvas` → http://localhost:4400. The sidebar lists DESIGN.md (drawn as tokens and rules), Components
(the catalog for the variants the filter shows; a click steps through them), the consistency report and app
comparison (each with when it last ran, or how many covered screens changed since), Languages, and every screen
with its versions. Filters: status (active, approved, needs review, all), versions, variants, theme, width and
language. The reports and Languages follow the filters too: they show only the screens the canvas shows. Selecting a version opens the inspector: status, note, checks, and
Copy for its reference. Pick mode (`p`) highlights the element under the pointer; a click copies its reference,
Shift-click collects several (Copy all, Add to note). Keys: `/` search, `j`/`k` next and previous, `a` approve,
`p` pick, `f` fit, `0` actual size, double-click to use a frame, `Esc` to leave.
