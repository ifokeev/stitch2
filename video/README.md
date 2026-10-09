# stitch2 product video

An 80-second product video made from real recordings of the stitch2 canvas on the [gymgym example](../examples/gymgym),
edited with [Remotion](https://www.remotion.dev).

```bash
npm install
node record/record.mjs            # records the canvas clips into public/clips (needs ffmpeg and Chromium)
npx remotion studio               # preview and edit
npx remotion render ProductVideo out/stitch2.mp4
```

- `record/record.mjs` copies the example to a scratch folder, starts `stitch2 canvas` from this repository's sources
  and drives it with Playwright: an agent's draft with a hand-built tab bar, the checks, the consistency report,
  pick mode, the fix and approval, DESIGN.md and a colour change. It also saves the real terminal output of each
  command (`public/terminal.json`). Rerun it after changing the canvas so the video shows the current one.
- `src/` is the edit: `ProductVideo.tsx` lays out the scenes, `lines.ts` holds the narration.
- The narration (`public/voice/`, Gemini TTS, voice Iapetus) and the music (`public/music/`, Eleven Music) were
  generated with [Pipe2.ai](https://pipe2.ai). To change a line, regenerate its file and update `VOICE_SEC` in
  `src/lines.ts`.

Remotion is free for individuals and teams of up to three; see its
[licence](https://www.remotion.dev/license).
