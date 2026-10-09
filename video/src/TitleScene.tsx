import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, sans } from "./theme";

const rise = (t: number, at: number) => interpolate(t, [at, at + 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

/** The problem: two screens from the same agent, two different tab bars. */
export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const a = rise(t, 0.3);
  const b = rise(t, 3.3);
  const bars = rise(t, 1.4);
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", fontFamily: sans }}>
      <div style={{ fontSize: 84, fontWeight: 600, color: C.text, letterSpacing: "-0.03em", opacity: a, translate: `0px ${(1 - a) * 20}px` }}>
        Agents draft a screen in a minute.
      </div>
      <div style={{ fontSize: 84, fontWeight: 600, color: C.accent, letterSpacing: "-0.03em", marginTop: 8, opacity: b, translate: `0px ${(1 - b) * 20}px` }}>
        Keeping fifty consistent is the hard part.
      </div>
      <div style={{ display: "flex", gap: 48, marginTop: 90, opacity: bars, translate: `0px ${(1 - bars) * 30}px` }}>
        {[
          ["home · v1", "tabbar-catalog.png"],
          ["home · v2, by the agent", "tabbar-drift.png"],
        ].map(([label, file]) => (
          <div key={file} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 24, color: C.muted, fontWeight: 500 }}>{label}</div>
            <Img src={staticFile(`stills/${file}`)} style={{ width: 640, borderRadius: 14, border: `1px solid ${C.edge}` }} />
          </div>
        ))}
      </div>
      <Audio src={staticFile("voice/title.mp3")} from={Math.round(0.4 * fps)} premountFor={fps} />
    </AbsoluteFill>
  );
};
