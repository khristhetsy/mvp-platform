import { Archivo, Inter, IBM_Plex_Mono } from "next/font/google";

/**
 * iCapOS public marketing site typography (spec §4):
 *   Display — Archivo (variable width axis; per-heading `wdth` set via CSS
 *             font-variation-settings on h1/h2/h3 in the marketing layout).
 *   Body    — Inter 400/500/600.
 *   Mono    — IBM Plex Mono 400/500/600 for data, labels, scores, eyebrows.
 * All loaded with `display: 'swap'`. The CSS variables are consumed by the
 * `--font-site-*` tokens in globals.css.
 */

export const siteDisplay = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-site-archivo",
  weight: "variable",
});

export const siteBody = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-site-inter",
  weight: ["400", "500", "600"],
});

export const siteMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-site-plex-mono",
  weight: ["400", "500", "600"],
});

/** Combined className for the marketing layout `<body>`/root wrapper. */
export const siteFontVariables = `${siteDisplay.variable} ${siteBody.variable} ${siteMono.variable}`;
