import React from "react";
import { Composition } from "remotion";
import { ProductVideo } from "./ProductVideo";

// Scenes 7.5 + 9.5 + 11 + 9.5 + 8.6 + 8.2 + 8 + 8.3 + 7.5 + 5.5 = 83.6 s, minus 9 fades of 12 frames.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition id="ProductVideo" component={ProductVideo} durationInFrames={2400} fps={30} width={1920} height={1080} />
  );
};
