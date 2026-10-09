import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, mono, sans } from "./theme";

/** A floating card over the recording: a terminal line, a pasted reference, a DESIGN.md edit. */
export const Card: React.FC<{
  at: number;
  until?: number;
  title: string;
  lines: { text: string; color?: string }[];
  x?: number;
  y?: number;
  width?: number;
}> = ({ at, until = 99, title, lines, x = 360, y = 700, width = 1200 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (t < at || t > until + 0.4) return null;
  const inK = interpolate(t, [at, at + 0.45], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const outK = interpolate(t, [until, until + 0.35], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        opacity: inK * outK,
        translate: `0px ${(1 - inK) * 24}px`,
        background: "rgba(20, 20, 23, 0.96)",
        border: `1px solid ${C.edge}`,
        borderRadius: 16,
        boxShadow: "0 24px 60px rgba(0,0,0,.55)",
        padding: "18px 24px 20px",
      }}
    >
      <div style={{ fontFamily: sans, fontSize: 20, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
      {lines.map((l, i) => (
        <div key={i} style={{ fontFamily: mono, fontSize: 27, lineHeight: "40px", color: l.color ?? C.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {l.text}
        </div>
      ))}
    </div>
  );
};
