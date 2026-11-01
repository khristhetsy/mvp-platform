import localFont from "next/font/local";

/**
 * iCapOS public marketing site typography (spec §4):
 *   Display — Archivo (variable width axis; per-heading `wdth` set via CSS
 *             font-variation-settings on h1/h2/h3 in the marketing layout).
 *   Body    — Inter 400/500/600.
 *   Mono    — IBM Plex Mono 400/500/600 for data, labels, scores, eyebrows.
 * Self-hosted from src/fonts (no download from Google at build time). All loaded with `display: 'swap'`. The CSS variables are consumed by the
 * `--font-site-*` tokens in globals.css.
 */

export const siteDisplay = localFont({
  src: "../../fonts/Archivo-latin-wght.woff2",
  display: "swap",
  variable: "--font-site-archivo",
  weight: "100 900",
});

export const siteBody = localFont({
  src: "../../fonts/Inter-latin-wght.woff2",
  display: "swap",
  variable: "--font-site-inter",
  weight: "100 900",
});

export const siteMono = localFont({
  src: [
    { path: "../../fonts/IBMPlexMono-latin-400.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/IBMPlexMono-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/IBMPlexMono-latin-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-site-plex-mono",
});

/** Combined className for the marketing layout `<body>`/root wrapper. */
export const siteFontVariables = `${siteDisplay.variable} ${siteBody.variable} ${siteMono.variable}`;
