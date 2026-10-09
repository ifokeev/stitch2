# Screens, versions and approval

The canvas and the agents share one model: an app **screen** (home, settings, …) has **versions**, each for a
**device** (mobile or desktop), and each version has a **status**. The user decides; agents read the decision
and build on it. Meta tag names below use the project's prefix (`<p>`, from `stitch2.config.json`).

## Names and files

- Screen names are lowercase with hyphens and name what the user sees; one per step of a flow
  (`checkout-1`, `checkout-2`). Reuse existing names (`stitch2 screens` lists them).
- A version is one file, `<screens dir>/<screen>/<device>-v<N>.html`, N the next free number for that device.
  Its head carries `<p>-screen`, `<p>-device` (mobile | desktop), `<p>-status`, `<p>-source` (stitch | lab),
  `<p>-frame-width` (390 mobile, 1280 desktop) and, written by the user, `<p>-note`. Older files elsewhere
  carry the same tags.

## New version or edit?

- **New version** for every new attempt: a new direction, a regeneration, an export from a generator, a
  redesign after feedback on an approved screen. It starts as `draft` and ends as `review`.
- **Edit in place** only to finish your own draft, or to answer a note on a version still in `review` or
  `draft`.
- **Never edit** an `approved` or `archived` version: copy it to the next number and change the copy.

## Statuses

| Status | Meaning | Who sets it |
|---|---|---|
| `draft` | Work in progress | The agent, while working |
| `review` | Finished, waiting for the user ("Needs review") | The agent, when done |
| `approved` | The reference: build on it, match it, implement it | The user only |
| `archived` | History: superseded or rejected; hidden on the canvas | The user; approving a version archives the previously approved one |

## How to use them

1. Before designing, run `stitch2 screens` (a name or `--status approved` narrows it) and open the approved
   versions of the screens next to yours.
2. A note is the user's feedback: address every point in your next version or edit, and say how.
3. Never set `approved` yourself; never build on an archived version unless asked.
4. Only approved versions get implemented in the product.
5. When the user pastes a reference copied from the canvas, such as `home mobile v2
   (design/screens/home/mobile-v2.html)`, open that file: it names exactly the version they mean.
6. A reference to an element adds its source line, its tag and its text: `home mobile v1
   (design/screens/home/mobile-v1.html:36) <gg-button> “Start Push”`. The element is the one with that tag
   starting on that line (the text tells apart two on one line); a component's tag stands for everything it
   renders. Change that element, or the component itself when the change belongs on every screen. Several
   references in one message are numbered in the order the user picked them.

## Implementing an approved version

Build the screen in the app from the same components the screens use, in the version's order, with the app's
own data, strings and behaviour; keep the app's tests passing. Then run `stitch2 compare <screen>` with the app
running: fix every `missing` component and look at the side-by-side report. `extra` and `order` warnings are
fine when the app needs them (a desktop-only control, a frame drawn by layout); say so when you hand over. When
the page needs a state first (an open sheet, a running workout), add a `prepare` module for its route.

## Desktop

Desktop is a device of the same screen, designed after the mobile version is approved: `desktop-v<N>.html`,
frame width 1280, the same components and type levels, the layout from DESIGN.md (typically a sidebar instead
of a tab bar, a content max width, two columns where it helps). Shared components get their desktop form in the
component, before the first desktop screen.

## The canvas

`stitch2 canvas` → http://localhost:4400. The sidebar lists DESIGN.md (drawn as tokens and rules), the
consistency report, the component catalog and every screen with its versions; filters for active, approved,
needs review or all, and mobile or desktop. Selecting a version opens the inspector: status, note, checks, and
Copy for its reference. Pick mode (`p`) highlights the element under the pointer; a click copies its reference,
Shift-click collects several (Copy all, Add to note). Keys: `/` search, `j`/`k` next and previous, `a` approve,
`p` pick, `f` fit, `0` actual size, double-click to use a frame, `Esc` to leave.
