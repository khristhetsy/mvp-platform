export const PAGE_BUILDER_SLUGS = ["home", "founders", "investors", "deals", "login"] as const;

export type PageBuilderSlug = (typeof PAGE_BUILDER_SLUGS)[number];

export const APPROVED_BLOCK_TYPES = [
  "hero",
  "trust_badges",
  "feature_grid",
  "metrics_row",
  "cta_band",
  "text_section",
  "image_banner",
  "spacer",
] as const;

export type PageBlockType = (typeof APPROVED_BLOCK_TYPES)[number];

export type PageBlock = {
  id: string;
  type: PageBlockType;
  visible: boolean;
  props: Record<string, unknown>;
};

export type PageLayoutDocument = {
  version: 1;
  pageSlug: PageBuilderSlug | string;
  blocks: PageBlock[];
};

export type PageBuilderDraftRow = {
  id: string;
  page_slug: string;
  layout: PageLayoutDocument;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PageBuilderSnapshotRow = {
  id: string;
  draft_id: string;
  page_slug: string;
  layout: PageLayoutDocument;
  label: string | null;
  created_by: string | null;
  created_at: string;
};

export type ValidationWarning = {
  blockId?: string;
  code: string;
  message: string;
  severity: "warning" | "error";
};

export type PreviewMode = "desktop" | "mobile";
