import React from "react";
import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "./Caption";
import { Cursor, Rec } from "./Cursor";
import { SceneName } from "./lines";
import { BOX, C } from "./theme";

export type Shot = { t: number; scale: number; x: number; y: number };

/**
 * One recorded clip in a window frame: the clip from `from` seconds, the recorded cursor, a slow camera
 * (zoom keyframes around a focal point, in 0–1 of the frame), the voice line and its caption, and any cards.
 */
export const ClipScene: React.FC<{
  clip: string;
  rec: Rec;
  from: number;
  scene: SceneName;
  shots?: Shot[];
  children?: React.ReactNode;
}> = ({ clip, rec, from, scene, shots = [], children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const keys: Shot[] = [{ t: 0, scale: 1, x: 0.5, y: 0.5 }, ...shots];
  const times = keys.map((k) => k.t);
  const ease = Easing.bezier(0.45, 0, 0.2, 1);
  const pick = (f: (k: Shot) => number) =>
    keys.length < 2 ? f(keys[0]) : interpolate(t, times, keys.map(f), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const scale = pick((k) => k.scale);
  const fx = pick((k) => k.x);
  const fy = pick((k) => k.y);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div
        style={{
          position: "absolute",
          left: BOX.x,
          top: BOX.y,
          width: BOX.w,
          height: BOX.h,
          borderRadius: 18,
          overflow: "hidden",
          border: `1px solid ${C.edge}`,
          boxShadow: "0 30px 80px rgba(0,0,0,.6)",
        }}
      >
        <div style={{ position: "absolute", inset: 0, scale: String(scale), transformOrigin: `${fx * 100}% ${fy * 100}%` }}>
          <Video src={staticFile(`clips/${clip}.mp4`)} trimBefore={Math.round(from * fps)} muted premountFor={fps} style={{ width: BOX.w, height: BOX.h }} />
          <Cursor rec={rec} from={from} />
        </div>
      </div>
      {children}
      <Audio src={staticFile(`voice/${scene}.mp3`)} from={Math.round(0.5 * fps)} premountFor={fps} />
      <Caption scene={scene} delay={0.5} />
    </AbsoluteFill>
  );
};
