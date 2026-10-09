import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BOX, VIEW } from "./theme";

export type Rec = {
  duration: number;
  cursor: { t: number; x: number; y: number; click?: boolean }[];
  marks: Record<string, number>;
};

/** The recorded mouse path (headless recordings have no cursor), with a ripple on each click. */
export const Cursor: React.FC<{ rec: Rec; from: number }> = ({ rec, from }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = from + frame / fps;
  const path = rec.cursor;
  let i = path.findIndex((p) => p.t > t);
  if (i === -1) i = path.length;
  const a = path[Math.max(0, i - 1)];
  const b = path[Math.min(path.length - 1, i)];
  const k = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const sx = BOX.w / VIEW.w;
  const x = (a.x + (b.x - a.x) * k) * sx;
  const y = (a.y + (b.y - a.y) * k) * sx;
  const click = [...path].reverse().find((p) => p.click && p.t <= t && t - p.t < 0.6);
  const ripple = click ? (t - click.t) / 0.6 : 1;
  return (
    <>
      {click ? (
        <div
          style={{
            position: "absolute",
            left: click.x * sx - 28,
            top: click.y * sx - 28,
            width: 56,
            height: 56,
            borderRadius: 28,
            border: "3px solid rgba(232, 102, 44, 0.9)",
            scale: interpolate(ripple, [0, 1], [0.3, 1.4], { easing: Easing.out(Easing.cubic) }),
            opacity: interpolate(ripple, [0, 1], [1, 0]),
          }}
        />
      ) : null}
      <svg width={30} height={30} viewBox="0 0 24 24" style={{ position: "absolute", left: x - 4, top: y - 2, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))" }}>
        <path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.8 L11.6 14 L18 14 Z" fill="#fff" stroke="#111" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </>
  );
};
