/**
 * A theme is a whole "look", not a palette swap: colour, type pairing, the shape of
 * the cover frame, corner style and how the letter sits on the page.
 */
export interface ThemeTokens {
  label: string;
  // colour
  bg: string;
  surface: string;
  soft: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  onPrimary: string;
  // type
  fontHeading: string;
  fontBody: string;
  fontHand: string;
  titleWeight: number;        // match the font: single-weight display faces must stay at 400
  titleScale: number;         // optical size correction between typefaces
  h2Weight: number;
  recipientStyle: "italic" | "normal";
  // shape
  radius: string;
  frame: "arch" | "circle" | "soft";  // cover photo frame
  letterTilt: string;
}

const HAND = `"Kalam", "Noto Sans Devanagari", cursive`;

export const THEMES: Record<string, ThemeTokens> = {
  // Romantic and soft: high-contrast serif, arched window frame, gently tilted paper.
  "rose-garden": {
    label: "Rose garden",
    bg: "#FFF8F0", surface: "#FFFDF9", soft: "#FCE9E4", text: "#4A0E1F", muted: "#8A5A66",
    primary: "#E11D48", accent: "#F59E0B", onPrimary: "#FFFFFF",
    fontHeading: `"Fraunces", "Noto Serif Devanagari", Georgia, serif`,
    fontBody: `"Poppins", "Noto Sans Devanagari", system-ui, sans-serif`,
    fontHand: HAND,
    titleWeight: 700, titleScale: 1, h2Weight: 600, recipientStyle: "italic",
    radius: "14px", frame: "arch", letterTilt: "-0.4deg",
  },
  // Festive and bold: heavy display face, round medallion frame, crisp corners, straight paper.
  "marigold-sun": {
    label: "Marigold sun",
    bg: "#FFF6DD", surface: "#FFFBEE", soft: "#FFE9B3", text: "#3B2300", muted: "#7C5A1F",
    primary: "#C2410C", accent: "#BE123C", onPrimary: "#FFFFFF",
    fontHeading: `"Rozha One", "Noto Serif Devanagari", Georgia, serif`,
    fontBody: `"Hind", "Noto Sans Devanagari", system-ui, sans-serif`,
    fontHand: HAND,
    titleWeight: 400, titleScale: 0.92, h2Weight: 400, recipientStyle: "normal",
    radius: "4px", frame: "circle", letterTilt: "0deg",
  },
  // Quiet and nocturnal: light elegant serif, rounded-square frame, generous curves.
  "midnight-stars": {
    label: "Midnight stars",
    bg: "#14102B", surface: "#1E1840", soft: "#251E52", text: "#F4EFFF", muted: "#B2A8D9",
    primary: "#F9A8D4", accent: "#FDE68A", onPrimary: "#2A0F3D",
    fontHeading: `"Cormorant Garamond", "Noto Serif Devanagari", Georgia, serif`,
    fontBody: `"DM Sans", "Noto Sans Devanagari", system-ui, sans-serif`,
    fontHand: HAND,
    titleWeight: 500, titleScale: 1.18, h2Weight: 600, recipientStyle: "italic",
    radius: "22px", frame: "soft", letterTilt: "0.5deg",
  },
};

export const DEFAULT_THEME = "rose-garden";

const FRAMES: Record<ThemeTokens["frame"], { radius: string; ratio: string; width: string }> = {
  arch: { radius: "999px 999px var(--mfy-radius) var(--mfy-radius)", ratio: "3 / 4", width: "min(66%, 15rem)" },
  circle: { radius: "50%", ratio: "1 / 1", width: "min(68%, 15rem)" },
  soft: { radius: "var(--mfy-radius)", ratio: "4 / 5", width: "min(72%, 16rem)" },
};

export function themeToCssVars(preset: string): Record<string, string> {
  const t = THEMES[preset] ?? THEMES[DEFAULT_THEME]!;
  const fr = FRAMES[t.frame];
  return {
    "--mfy-bg": t.bg,
    "--mfy-surface": t.surface,
    "--mfy-soft": t.soft,
    "--mfy-text": t.text,
    "--mfy-muted": t.muted,
    "--mfy-primary": t.primary,
    "--mfy-accent": t.accent,
    "--mfy-on-primary": t.onPrimary,
    "--mfy-font-heading": t.fontHeading,
    "--mfy-font-body": t.fontBody,
    "--mfy-font-hand": t.fontHand,
    "--mfy-title-weight": String(t.titleWeight),
    "--mfy-title-scale": String(t.titleScale),
    "--mfy-h2-weight": String(t.h2Weight),
    "--mfy-recipient-style": t.recipientStyle,
    "--mfy-radius": t.radius,
    "--mfy-frame-radius": fr.radius,
    "--mfy-frame-ratio": fr.ratio,
    "--mfy-frame-width": fr.width,
    "--mfy-tilt": t.letterTilt,
  };
}
