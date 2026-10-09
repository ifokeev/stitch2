import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "./Caption";
import { C, mono } from "./theme";

/** A terminal: the command typed, then its real output a line at a time. */
export const TerminalScene: React.FC<{ cmd: string; out: string[] }> = ({ cmd, out }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const typed = Math.floor(interpolate(t, [0.6, 2.2], [0, cmd.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const shown = Math.floor(interpolate(t, [2.6, 5.2], [0, out.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const caret = Math.floor(t * 2) % 2 === 0 && typed < cmd.length + 1 && shown === 0;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", left: 240, top: 90, width: 1440, height: 780, background: C.panel, border: `1px solid ${C.edge}`, borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,.6)", overflow: "hidden" }}>
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, paddingLeft: 22, borderBottom: `1px solid ${C.edge}`, background: C.panel2 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />)}
          <div style={{ fontFamily: mono, fontSize: 20, color: C.faint, marginLeft: 16 }}>~/my-app</div>
        </div>
        <div style={{ padding: "30px 40px", fontFamily: mono, fontSize: 28, lineHeight: "44px", color: C.text }}>
          <div>
            <span style={{ color: C.accent }}>$ </span>
            {cmd.slice(0, typed)}
            {caret ? <span style={{ background: C.text }}>&nbsp;</span> : null}
          </div>
          {out.slice(0, shown).map((l, i) => (
            <div key={i} style={{ color: l.startsWith("  wrote") ? C.muted : l.startsWith("next") ? C.good : C.text, whiteSpace: "pre" }}>{l || "\u00a0"}</div>
          ))}
        </div>
      </div>
      <Audio src={staticFile("voice/setup.mp3")} from={Math.round(0.5 * fps)} premountFor={fps} />
      <Caption scene="setup" delay={0.5} bottom={64} />
    </AbsoluteFill>
  );
};
