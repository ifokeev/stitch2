import { loadFont as loadSans } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";

export const sans = loadSans("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;

// The canvas's own palette, so the video looks like the product.
export const C = {
  bg: "#0b0b0d",
  panel: "#141417",
  panel2: "#1c1c20",
  edge: "#2e2e33",
  text: "#f4f4f5",
  muted: "#a1a1aa",
  faint: "#71717a",
  accent: "#e8662c",
  good: "#3fb27f",
  warn: "#e5b54a",
};

// Recordings: a 1600×900 browser viewport, encoded at 1920×1080. On screen they sit in a 1536×864 frame.
export const VIEW = { w: 1600, h: 900 };
export const BOX = { x: 192, y: 40, w: 1536, h: 864 };
