import React from "react";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { interpolate, staticFile, useVideoConfig } from "remotion";
import { Card } from "./Card";
import { ClipScene } from "./ClipScene";
import { EndScene } from "./EndScene";
import { TerminalScene } from "./TerminalScene";
import { TitleScene } from "./TitleScene";
import { C } from "./theme";
import overview from "../public/clips/overview.json";
import draft from "../public/clips/draft.json";
import consistency from "../public/clips/consistency.json";
import pick from "../public/clips/pick.json";
import fix from "../public/clips/fix.json";
import designmd from "../public/clips/designmd.json";
import tokens from "../public/clips/tokens.json";
import terminal from "../public/terminal.json";

const firstLine = (s: string) => s.split("\n")[0].replace(/^✓\s+/, "").replace(/\s{2,}/g, "   ");
const setupOut = terminal.setup.out
  .split("\n")
  .filter((l) => /^(stitch2 setup|  wrote|next: stitch2 canvas)/.test(l))
  .map((l) => l.replace(/^(  wrote\s+\S+)\s+→.*$/, "$1").replace(/^next: stitch2 canvas.*$/, "next: npx stitch2 canvas"));

export const FADE = 12;

export const ProductVideo: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Title" durationInFrames={Math.round(7.5 * fps)} premountFor={fps}>
          <TitleScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="Canvas" durationInFrames={Math.round(9.5 * fps)} premountFor={fps}>
          <ClipScene clip="overview" rec={overview} from={2} scene="overview" shots={[{ t: 6.5, scale: 1, x: 0.5, y: 0.5 }, { t: 9.5, scale: 1.12, x: 0.55, y: 0.3 }]} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="Draft" durationInFrames={Math.round(11 * fps)} premountFor={fps}>
          <ClipScene clip="draft" rec={draft} from={1} scene="draft" shots={[{ t: 7, scale: 1, x: 0.5, y: 0.5 }, { t: 8.6, scale: 1.55, x: 0.92, y: 0.42 }, { t: 11, scale: 1.6, x: 0.92, y: 0.44 }]}>
            <Card at={3.7} until={6.6} title="terminal" lines={[{ text: `$ ${terminal.checkDraft.cmd}`, color: C.muted }, { text: firstLine(terminal.checkDraft.out), color: C.warn }]} y={690} />
          </ClipScene>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="Consistency" durationInFrames={Math.round(9.5 * fps)} premountFor={fps}>
          <ClipScene clip="consistency" rec={consistency} from={1.5} scene="consistency" shots={[{ t: 4, scale: 1, x: 0.5, y: 0.5 }, { t: 6, scale: 1.45, x: 0.42, y: 0.5 }, { t: 9.5, scale: 1.5, x: 0.42, y: 0.5 }]} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="Pick" durationInFrames={Math.round(8.6 * fps)} premountFor={fps}>
          <ClipScene clip="pick" rec={pick} from={3.5} scene="pick" shots={[{ t: 2.5, scale: 1, x: 0.5, y: 0.5 }, { t: 4.5, scale: 1.4, x: 0.42, y: 0.92 }, { t: 8.6, scale: 1.4, x: 0.42, y: 0.92 }]}>
            <Card at={pick.marks.copied - 3.5 + 0.4} title="pasted to the agent" lines={[{ text: terminal.reference }, { text: "Use the catalog's tab bar here.", color: C.muted }]} y={330} />
          </ClipScene>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="Fix" durationInFrames={Math.round(8.2 * fps)} premountFor={fps}>
          <ClipScene clip="fix" rec={fix} from={1.5} scene="fix" shots={[{ t: 3.6, scale: 1, x: 0.5, y: 0.5 }, { t: 5, scale: 1.5, x: 0.92, y: 0.2 }, { t: 8.2, scale: 1.55, x: 0.92, y: 0.2 }]}>
            <Card at={fix.marks.checked - 1.5 - 0.1} until={fix.marks.checked - 1.5 + 1.6} title="terminal" lines={[{ text: `$ ${terminal.checkFixed.cmd}`, color: C.muted }, { text: firstLine(terminal.checkFixed.out), color: C.good }]} y={690} />
          </ClipScene>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="DESIGN.md" durationInFrames={Math.round(8 * fps)} premountFor={fps}>
          <ClipScene clip="designmd" rec={designmd} from={1.2} scene="designmd" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="Tokens" durationInFrames={Math.round(8.3 * fps)} premountFor={fps}>
          <ClipScene clip="tokens" rec={tokens} from={0.8} scene="tokens">
            <Card at={tokens.marks.tokens - 0.8 - 0.9} until={tokens.marks.tokens - 0.8 + 1.4} title="DESIGN.md" lines={[{ text: '-  ember: "#E8662C"', color: "#e5484d" }, { text: '+  ember: "#2F6FEB"', color: C.good }]} x={460} width={560} y={640} />
          </ClipScene>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="Setup" durationInFrames={Math.round(7.5 * fps)} premountFor={fps}>
          <TerminalScene cmd={terminal.setup.cmd} out={setupOut} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="End" durationInFrames={Math.round(5.5 * fps)} premountFor={fps}>
          <EndScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Audio
        name="Music"
        src={staticFile("music/underscore.mp3")}
        premountFor={fps}
        volume={(f) => interpolate(f, [0, fps, durationInFrames - 2 * fps, durationInFrames], [0, 0.16, 0.16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
    </>
  );
};
