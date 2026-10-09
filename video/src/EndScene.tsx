import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, mono, sans } from "./theme";

export const EndScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const k = interpolate(t, [0.1, 0.9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const k2 = interpolate(t, [0.8, 1.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", fontFamily: sans }}>
      <div style={{ fontSize: 168, fontWeight: 700, color: C.text, letterSpacing: "-0.05em", opacity: k, scale: String(0.94 + 0.06 * k) }}>
        stitch<span style={{ color: C.accent }}>2</span>
      </div>
      <div style={{ fontSize: 40, color: C.muted, marginTop: 4, opacity: k }}>A design lab for agent-built UI</div>
      <div style={{ display: "flex", gap: 28, marginTop: 64, opacity: k2 }}>
        <div style={{ fontFamily: mono, fontSize: 34, color: C.text, background: C.panel, border: `1px solid ${C.edge}`, borderRadius: 14, padding: "16px 28px" }}>
          <span style={{ color: C.accent }}>$ </span>npm i -D stitch2
        </div>
        <div style={{ fontFamily: mono, fontSize: 34, color: C.text, background: C.panel, border: `1px solid ${C.edge}`, borderRadius: 14, padding: "16px 28px" }}>
          github.com/ifokeev/stitch2
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 48, fontSize: 22, color: C.faint, opacity: k2 }}>
        MIT licensed. Inspired by Google Stitch; not affiliated with Google.
      </div>
      <Audio src={staticFile("voice/end.mp3")} from={Math.round(0.4 * fps)} premountFor={fps} />
    </AbsoluteFill>
  );
};
