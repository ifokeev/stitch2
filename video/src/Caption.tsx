import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, sans } from "./theme";
import { LINES, SceneName, VOICE_SEC } from "./lines";

/** The scene's line, one sentence at a time, timed by its share of the voice. */
export const Caption: React.FC<{ scene: SceneName; delay: number; bottom?: number }> = ({ scene, delay, bottom = 52 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // A sentence ends at . ! ? followed by a space or the end (so "DESIGN.md" stays whole).
  const sentences = LINES[scene].split(/(?<=[.!?])\s+/);
  const total = sentences.reduce((n, s) => n + s.length, 0);
  const t = frame / fps - delay;
  let start = 0;
  let current = -1;
  sentences.forEach((s, i) => {
    if (t >= start - 0.05) current = i;
    start += (s.length / total) * VOICE_SEC[scene];
  });
  if (t < -0.05 || current < 0) return null;
  const last = current === sentences.length - 1;
  const opacity = last ? interpolate(t, [VOICE_SEC[scene] + 0.3, VOICE_SEC[scene] + 0.7], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", opacity }}>
      <div style={{ maxWidth: 1500, textAlign: "center", fontFamily: sans, fontSize: 40, lineHeight: "52px", fontWeight: 500, color: C.text, letterSpacing: "-0.01em" }}>
        {sentences[current]}
      </div>
    </div>
  );
};
