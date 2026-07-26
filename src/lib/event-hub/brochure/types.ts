// Event Brochure — edition + page types (build spec §5/§6).

export type BrochurePageType =
  | "cover"
  | "disclaimers"
  | "contents"
  | "introduction"
  | "agenda"
  | "presenters"
  | "team"
  | "sponsors_contact"
  | "custom"
  | "freeform";

export type CustomLayout = "text" | "text_image" | "full_image";

/** Free-form canvas block. Geometry (x/y/w/h) is stored in PDF points relative to
 *  the page trim box (0,0 = top-left), so the editor canvas maps 1:1 to print. */
export type FreeformBlockType = "heading" | "text" | "image" | "divider" | "callout";
export type FreeformBlock = {
  id: string;
  type: FreeformBlockType;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  imageUrl?: string;
  align?: "left" | "center" | "right";
  fontSize?: number;
  color?: string;
  bg?: string;
};

export type BrochurePage = {
  key: string;
  type: BrochurePageType;
  included: boolean;
  /** custom pages only */
  custom?: { layout: CustomLayout; heading?: string; body?: string; imageUrl?: string; carried?: boolean };
  /** freeform pages only — absolutely-positioned blocks in PDF points */
  blocks?: FreeformBlock[];
};

export type BrochureSize = "letter" | "a4" | "square";

/** Trim size in PDF points [width, height] — shared by editor, HTML, and PDF. */
export const TRIM_POINTS: Record<BrochureSize, [number, number]> = {
  letter: [612, 792],
  a4: [595.28, 841.89],
  square: [576, 576],
};

/** Theme presets — recolor the cover fill, headings, and accents booklet-wide. */
export type BrochureTheme = "navy" | "teal" | "violet" | "mono";
export type ThemeColors = { primary: string; accent: string; coverText: string; coverBadge: string };
export const THEMES: Record<BrochureTheme, ThemeColors> = {
  navy: { primary: "#0c2340", accent: "#2E78F5", coverText: "#ffffff", coverBadge: "#9fd0ff" },
  teal: { primary: "#0f6e56", accent: "#1D9E75", coverText: "#ffffff", coverBadge: "#9fe1cb" },
  violet: { primary: "#3C3489", accent: "#7F77DD", coverText: "#ffffff", coverBadge: "#cecbf6" },
  mono: { primary: "#2C2C2A", accent: "#5F5E5A", coverText: "#ffffff", coverBadge: "#d3d1c7" },
};
export const THEME_LABEL: Record<BrochureTheme, string> = { navy: "Navy", teal: "Teal", violet: "Violet", mono: "Mono" };
export type BrochureStatus = "draft" | "generated" | "archived_import";

export type BrochureEdition = {
  id: string;
  eventId: string | null;
  baseEditionId: string | null;
  title: string;
  status: BrochureStatus;
  pageConfig: BrochurePage[];
  overrides: Record<string, Record<string, string>>;
  size: BrochureSize;
  theme: BrochureTheme;
  coverThumbPath: string | null;
  pdfDigitalPath: string | null;
  pdfPrintPath: string | null;
  published: boolean;
  publishedAt: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Pages that can never be removed, and their pinned order at the top. */
export const LOCKED_PAGES: BrochurePageType[] = ["cover", "disclaimers"];

/** Default page set, in order (§5). */
export function defaultPageConfig(): BrochurePage[] {
  const types: BrochurePageType[] = [
    "cover",
    "disclaimers",
    "contents",
    "introduction",
    "agenda",
    "presenters",
    "team",
    "sponsors_contact",
  ];
  return types.map((type) => ({ key: type, type, included: true }));
}

export const PAGE_LABEL: Record<BrochurePageType, string> = {
  cover: "Cover",
  disclaimers: "Disclaimers",
  contents: "Contents",
  introduction: "Introduction",
  agenda: "Agenda",
  presenters: "Presenters",
  team: "MC & Team",
  sponsors_contact: "Sponsors & Contact",
  custom: "Custom page",
  freeform: "Design page",
};

/** A blank free-form design page seeded with a heading + text block. */
export function newFreeformPage(key: string): BrochurePage {
  return {
    key,
    type: "freeform",
    included: true,
    blocks: [
      { id: `${key}-h`, type: "heading", x: 54, y: 64, w: 468, h: 30, text: "Heading", fontSize: 24, align: "left" },
      { id: `${key}-t`, type: "text", x: 54, y: 108, w: 468, h: 80, text: "Add your copy here.", fontSize: 13, align: "left" },
    ],
  };
}
