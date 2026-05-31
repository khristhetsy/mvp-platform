import { APPROVED_BLOCK_TYPES } from "@/lib/page-builder/types";
import type { PageBlock, PageLayoutDocument, ValidationWarning } from "@/lib/page-builder/types";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidHref(href: string) {
  if (!href) return false;
  return href.startsWith("/") || href.startsWith("https://") || href.startsWith("http://");
}

export function validateLayout(layout: PageLayoutDocument): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (layout.version !== 1) {
    warnings.push({
      code: "unsupported_version",
      message: "Layout version must be 1 for Phase 1 lab.",
      severity: "error",
    });
  }

  if (!layout.pageSlug) {
    warnings.push({
      code: "missing_page_slug",
      message: "Layout is missing pageSlug.",
      severity: "error",
    });
  }

  const visibleBlocks = layout.blocks.filter((b) => b.visible);

  if (visibleBlocks.length === 0) {
    warnings.push({
      code: "no_visible_blocks",
      message: "At least one visible block is recommended for preview.",
      severity: "warning",
    });
  }

  if (layout.blocks.length > 24) {
    warnings.push({
      code: "too_many_blocks",
      message: "More than 24 blocks may hurt performance in preview.",
      severity: "warning",
    });
  }

  for (const block of layout.blocks) {
    warnings.push(...validateBlock(block));
  }

  const heroCount = visibleBlocks.filter((b) => b.type === "hero").length;
  if (heroCount > 1) {
    warnings.push({
      code: "multiple_heroes",
      message: "Multiple visible hero blocks may create redundant headlines.",
      severity: "warning",
    });
  }

  return warnings;
}

function validateBlock(block: PageBlock): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (!APPROVED_BLOCK_TYPES.includes(block.type)) {
    warnings.push({
      blockId: block.id,
      code: "unknown_block_type",
      message: `Block type "${block.type}" is not approved for Phase 1.`,
      severity: "error",
    });
    return warnings;
  }

  if (!block.visible) return warnings;

  if (block.type === "hero") {
    if (!asString(block.props.headline)) {
      warnings.push({
        blockId: block.id,
        code: "hero_missing_headline",
        message: "Hero block is missing a headline.",
        severity: "error",
      });
    }
    const primaryHref = asString(block.props.primaryCtaHref);
    const primaryLabel = asString(block.props.primaryCtaLabel);
    if (primaryLabel && !isValidHref(primaryHref)) {
      warnings.push({
        blockId: block.id,
        code: "hero_invalid_primary_cta",
        message: "Hero primary CTA needs a valid href (e.g. /submit-company).",
        severity: "warning",
      });
    }
  }

  if (block.type === "cta_band") {
    const label = asString(block.props.ctaLabel);
    const href = asString(block.props.ctaHref);
    if (label && !isValidHref(href)) {
      warnings.push({
        blockId: block.id,
        code: "cta_invalid_href",
        message: "CTA band button needs a valid href.",
        severity: "warning",
      });
    }
    if (!asString(block.props.title)) {
      warnings.push({
        blockId: block.id,
        code: "cta_missing_title",
        message: "CTA band is missing a title.",
        severity: "warning",
      });
    }
  }

  if (block.type === "text_section") {
    if (!asString(block.props.title) && !asString(block.props.body)) {
      warnings.push({
        blockId: block.id,
        code: "text_empty",
        message: "Text section has no title or body.",
        severity: "warning",
      });
    }
  }

  if (block.type === "image_banner") {
    const url = asString(block.props.imageUrl);
    if (!url) {
      warnings.push({
        blockId: block.id,
        code: "image_missing_url",
        message: "Image banner is missing imageUrl.",
        severity: "error",
      });
    }
    if (!asString(block.props.alt)) {
      warnings.push({
        blockId: block.id,
        code: "image_missing_alt",
        message: "Image banner should include alt text.",
        severity: "warning",
      });
    }
  }

  if (block.type === "feature_grid") {
    const items = block.props.items;
    if (!Array.isArray(items) || items.length === 0) {
      warnings.push({
        blockId: block.id,
        code: "feature_grid_empty",
        message: "Feature grid has no items.",
        severity: "warning",
      });
    }
  }

  return warnings;
}

export function parseLayoutDocument(raw: unknown): PageLayoutDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as PageLayoutDocument;
  if (doc.version !== 1 || !Array.isArray(doc.blocks)) return null;
  return doc;
}
