// Pitch-deck color themes. Shared by the wizard preview, PDF (pdfkit) and PPTX (pptxgenjs).
// Colors are stored with a leading '#'. For pptxgenjs (which wants bare hex) strip it via hex().

export interface DeckTheme {
  id: string;
  label: string;
  swatch: string;   // small color chip in the picker
  bg: string;       // slide background
  accent: string;   // eyebrow / accent
  headline: string; // headline text
  body: string;     // body / bullet text
  footer: string;   // footer text
  chart: [string, string, string, string]; // chart palette (reads on this bg)
}

export const DECK_THEMES: DeckTheme[] = [
  {
    id: "navy",
    label: "Navy",
    swatch: "#0C2340",
    bg: "#0C2340",
    accent: "#7FA8E0",
    headline: "#FFFFFF",
    body: "#DCE6F5",
    footer: "#6B7DA0",
    chart: ["#85B7EB", "#5DCAA5", "#EF9F27", "#9085E9"],
  },
  {
    id: "midnight",
    label: "Midnight",
    swatch: "#101114",
    bg: "#101114",
    accent: "#8AB4F8",
    headline: "#FFFFFF",
    body: "#C9CCD1",
    footer: "#7A7E85",
    chart: ["#7FA8E0", "#5DCAA5", "#EFC94C", "#B29CE8"],
  },
  {
    id: "ocean",
    label: "Ocean",
    swatch: "#0F4C5C",
    bg: "#0F4C5C",
    accent: "#79C7D4",
    headline: "#FFFFFF",
    body: "#CDE7EC",
    footer: "#6F9AA3",
    chart: ["#7FD4E0", "#5DCAA5", "#EFC94C", "#F2A0A0"],
  },
  {
    id: "light",
    label: "Light",
    swatch: "#FFFFFF",
    bg: "#FFFFFF",
    accent: "#2E78F5",
    headline: "#0C2340",
    body: "#52514E",
    footer: "#9A9A95",
    chart: ["#2A78D6", "#1BAF7A", "#EDA100", "#4A3AA7"],
  },
];

export const DEFAULT_THEME = DECK_THEMES[0];

export function getDeckTheme(id: string | null | undefined): DeckTheme {
  return DECK_THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

/** Bare hex (no '#') for pptxgenjs. */
export function hex(color: string): string {
  return color.replace("#", "");
}
