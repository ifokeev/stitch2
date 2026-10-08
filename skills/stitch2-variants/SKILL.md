---
name: stitch2-variants
description: Get fresh-eyes versions of a screen from agents that see no other versions (stitch2 sandbox), so alternatives are not anchored to what exists; or test a change to the skills on output only the rules produced. Use when the user wants alternatives or a new direction, feels stuck with a design, wants several options to choose from, or when a skill or DESIGN.md rule changed and you need evidence it helps.
---

# Fresh-eyes variants with stitch2 sandboxes

An agent that can see a screen's existing versions copies them, even when asked for something new. A sandbox
is a folder with the project's design system, components, catalog, template and skills, and none of its screens,
so a fresh agent designs from the brief alone. Its result comes back as the next version of the screen, for
the user to compare on the canvas.

## Alternatives for a screen

1. **Write the brief** (`<screen>.md`): what the screen is for, its sections and controls, real data. Content
   and structure only: colours, fonts and shapes come from DESIGN.md. Name the file after the screen
   (`history.md` designs `history`). For several directions, write one brief per direction with one sentence
   on what differs (`history.md` in sandbox A: "a calendar first"; in sandbox B: "a list first").
2. **Create one sandbox per variant**: `stitch2 sandbox create /tmp/<project>-<screen>-a <brief.md>`.
   `--context home stats` adds the approved versions of other screens, so the variant stays consistent with
   them; `--device desktop` for desktop.
3. **Run a fresh agent in each**, with no shared conversation: a sub-agent started without forked history,
   working only in that folder, told to read its AGENTS.md and follow the skills there. Without sub-agents, give
   the user the folder and ask them to open a new agent session in it. Run them in parallel; they do not share
   anything.
4. **Import**: `stitch2 sandbox import <dir> --label "calendar first"` for each. Every screen comes back as the
   next version (status review) with a note saying where it came from.
5. **Compare** with `stitch2 check` and `stitch2 consistency` (they should pass like any version), then tell the
   user the versions are on the canvas side by side, what each tried, and which you would choose and why. The
   user approves one; the others get archived.

## Testing a change to the skills or DESIGN.md

1. Pick briefs for screens that already have versions made under the old rules.
2. Create sandboxes from the project with the changed skills or DESIGN.md, run fresh agents on the same briefs.
3. Import them with a label (`--label "rules v2"`) and compare with the old versions: `stitch2 check` (errors,
   warnings), `stitch2 type` (share of text on the type scale, number of sizes), `stitch2 consistency`, and the
   review rubric. Report numbers, not impressions; archive the trial versions afterwards.

## Rules

- Never copy files from the project into a sandbox by hand, and never tell the sandbox agent about the existing
  versions: that is the anchoring the sandbox avoids.
- Briefs say what, not how. A brief that describes another version's layout defeats the purpose.
- Imported versions are drafts like any other: the user decides.
