// The narration, as spoken (voice/<scene>.mp3) and as captioned.
export const LINES = {
  title: "Coding agents can draft a screen in a minute. Keeping fifty of them consistent is the hard part.",
  overview: "stitch2 puts every screen your agent designs on one canvas, built from your DESIGN.md and your own components.",
  draft: "Here, the agent drafts a new home screen. It shows up for review, and the checks flag what drifted: a tab bar built by hand, with raw colours.",
  consistency: "The consistency report puts every shared component side by side, so the odd one out is easy to spot.",
  pick: "Point at it, copy a reference with the file and line, and hand it to your agent.",
  fix: "The agent swaps in the catalog's tab bar. The checks pass, and you approve it.",
  designmd: "DESIGN.md holds your colours, type and rules, in Google's open format.",
  tokens: "Change one colour, and every screen follows. The same tokens can drive your app.",
  setup: "Set it up with one command. It writes the design system and links the skills your agent needs.",
  end: "stitch2. Open source, on npm.",
} as const;

export type SceneName = keyof typeof LINES;

// Seconds of each voice file (ffprobe), for caption timing.
export const VOICE_SEC: Record<SceneName, number> = {
  title: 6.46,
  overview: 7.54,
  draft: 9.41,
  consistency: 6.77,
  pick: 4.7,
  fix: 5.45,
  designmd: 5.69,
  tokens: 5.26,
  setup: 5.74,
  end: 3.41,
};
