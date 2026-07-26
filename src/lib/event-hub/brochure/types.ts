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
  | "custom";

export type CustomLayout = "text" | "text_image" | "full_image";

export type BrochurePage = {
  key: string;
  type: BrochurePageType;
  included: boolean;
  /** custom pages only */
  custom?: { layout: CustomLayout; heading?: string; body?: string; imageUrl?: string };
};

export type BrochureSize = "letter" | "a4" | "square";
export type BrochureStatus = "draft" | "generated" | "archived_import";

export type BrochureEdition = {
  id: string;
  eventId: string;
  baseEditionId: string | null;
  title: string;
  status: BrochureStatus;
  pageConfig: BrochurePage[];
  overrides: Record<string, Record<string, string>>;
  size: BrochureSize;
  coverThumbPath: string | null;
  pdfDigitalPath: string | null;
  pdfPrintPath: string | null;
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
};
