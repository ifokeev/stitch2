---
name: stitch2-import-from-google-stitch
description: Optional, only for projects that use Google Stitch (Google's product) — draft screens there through its MCP server and bring them into stitch2 as reviewable versions. Use when the user wants Stitch to generate a screen, design variants, or to push the project's DESIGN.md to a Stitch design system. (stitch2 is inspired by Google Stitch and is not affiliated with Google.)
---

# Drafting screens in Google Stitch

Google Stitch generates screens (HTML and a screenshot) from prompts against a design system. stitch2 treats
each export as a **draft version**: it lands next to the other versions of its screen on the canvas, gets
checked, and waits for the user's decision. The project skill names the Stitch project, its design system and
the data to use in prompts. How Stitch builds its screens: [references/how-stitch-works.md](references/how-stitch-works.md).

## Access

- The MCP server is `https://stitch.googleapis.com/mcp` with the header `X-Goog-Api-Key` (configure it in the
  agent's MCP settings; never commit or print the key).
- Without the MCP tools in the session, call it over HTTP: it is stateless JSON-RPC, one POST per call
  (`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"…","arguments":{…}}}`, headers
  `content-type: application/json` and `accept: application/json, text/event-stream`).

## Workflow

1. **Design system first.** Systemic changes go into DESIGN.md (Google's DESIGN.md format, which Stitch reads
   directly). Push it with `upload_design_md` (base64 of the file), then `create_design_system_from_design_md`
   with the returned screen instance; `list_design_systems` gives the asset id. Read it back: Stitch's fonts
   come from a fixed list of about 65 Google Fonts and it silently substitutes the others.
2. **Prompts carry content and structure**: the screen's sections, controls and realistic data, the shared
   chrome in the same words on every prompt (taken from DESIGN.md's Components), and what must not appear (no
   phone status bar, step labels, tip cards, extra helper text or buttons; Stitch adds them otherwise). Colours,
   fonts and radii come from the design system.
3. **One screen at a time**, `generate_screen_from_text` with `designSystem` set. Parallel calls caused
   "service unavailable", screens never placed on the canvas and screens stuck on "Preparing…". Never resend a
   running call. Empty `downloadUrl`s: poll `get_screen` for a few minutes, then generate once more.
4. **Known quirks.** `edit_screens` reports success but does not persist through the API; fix a screen by
   generating again with a corrected prompt. There is no API to delete a screen (the user removes it in the
   Stitch UI). `list_screens` lags. A prompt resembling an existing screen makes Stitch edit that one
   (unsaved): start it with "Create a NEW, separate screen (do not edit or replace any existing screen) titled
   '…'". `update_design_system` rewrites the design system's DESIGN.md text. Each reply carries follow-up
   suggestions (`outputComponents[].suggestion`): pass them on to the user.
5. **Bring it in as a version**: save the HTML as `<screens>/<screen>/<device>-v<N>.html` with the meta tags
   `<p>-screen`, `<p>-device`, `<p>-source` = `stitch`, `<p>-status` = `review` (see stitch2's screens.md),
   then `stitch2 localize <path>` (Stitch links images to Google URLs that can fail elsewhere or expire),
   `stitch2 check <path> --shots`, and look at it on the canvas.
6. **Consistency.** Stitch cannot share components between screens, so its chrome drifts (one project's first
   six screens had six different tab bars). Run the stitch2-consistency skill; the component catalog, not
   Stitch, decides how shared components look. Stitch screens are drafts: the product implements approved
   versions built from the project's components, never pasted Stitch HTML.
