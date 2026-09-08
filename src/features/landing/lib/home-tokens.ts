import { Hanken_Grotesk, DM_Mono } from "next/font/google";

// Home's own design system — deliberately independent of lp-theme.ts (used by
// /product, /how-it-works, /login, /signup). This is a full visual reset for
// the home page specifically: a different type pairing, a lighter palette,
// one accent instead of a bold black-and-blue treatment. The other marketing
// pages keep their existing look until/unless they're asked for separately.
export const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-home-sans" });
export const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-home-mono" });

export const HOME_VARS = {
  "--ink": "#202028",
  "--ink-2": "#4A4A55",
  "--muted": "#7C7C88",
  "--line": "#E4E4EA",
  "--paper": "#FFFFFF",
  "--paper-2": "#F4F4F7",
  "--indigo": "#4338CA",
  "--indigo-2": "#ECEBFB",
  "--amber": "#A85A00",
  "--amber-2": "#FBF1E3",
} as React.CSSProperties;

export const HOME_MAX = "1120px";
