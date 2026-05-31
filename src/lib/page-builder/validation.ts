import { PAGE_BUILDER_FORBIDDEN_PHRASES } from "@/lib/page-builder/content-rules";
import {
  flattenVisibleBlocks,
  getLayoutRegionDescriptors,
  getRegionBlocks,
  isLayoutBlockType,
  canPlaceInLayoutRegion,
  normalizeLayoutBlocks,
} from "@/lib/page-builder/layout-blocks";
import { APPROVED_BLOCK_TYPES, PAGE_BUILDER_SLUGS } from "@/lib/page-builder/types";
import type { PageBlock, PageLayoutDocument, ValidationWarning } from "@/lib/page-builder/types";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidCtaHref(href: string) {
  if (!href) return false;
  if (href.startsWith("/")) return !href.includes(" ");
  return href.startsWith("https://");
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectStrings(nested, out);
    }
  }
  return out;
}

function findForbiddenPhrases(text: string) {
  const normalized = text.toLowerCase();
  return PAGE_BUILDER_FORBIDDEN_PHRASES.filter((phrase) => normalized.includes(phrase));
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

  if (layout.blocks.length > 48) {
    warnings.push({
      code: "too_many_blocks",
      message: "More than 48 blocks may hurt performance in preview.",
      severity: "warning",
    });
  }

  const normalizedBlocks = normalizeLayoutBlocks(layout.blocks);

  for (const block of normalizedBlocks) {
    warnings.push(...validateBlock(block));
  }

  const visibleBlocks = flattenVisibleBlocks(normalizedBlocks.filter((b) => b.visible));

  if (visibleBlocks.length === 0) {
    warnings.push({
      code: "no_visible_blocks",
      message: "At least one visible block is recommended for preview.",
      severity: "warning",
    });
  }

  const heroCount = visibleBlocks.filter((b) => b.type === "hero").length;
  if (heroCount > 1) {
    warnings.push({
      code: "multiple_heroes",
      message: "Multiple visible hero blocks may create redundant headlines.",
      severity: "warning",
    });
  }

  const pageSlug = String(layout.pageSlug);
  if (pageSlug === "investors" || pageSlug === "deals") {
    const hasCompliance = visibleBlocks.some((b) => b.type === "compliance_notice");
    if (!hasCompliance) {
      warnings.push({
        code: "missing_compliance_notice",
        message: "Investor/deals pages must include a visible Compliance notice block before publish simulation.",
        severity: "error",
      });
    }
  }

  return warnings;
}

function validateCta(
  block: PageBlock,
  code: string,
  labelKey: string,
  hrefKey: string,
  labelName: string,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const label = asString(block.props[labelKey]);
  const href = asString(block.props[hrefKey]);
  if (label && !isValidCtaHref(href)) {
    warnings.push({
      blockId: block.id,
      code,
      message: `${labelName} needs a valid internal path (/) or https URL.`,
      severity: "error",
    });
  }
  return warnings;
}

function validateForbiddenCopy(block: PageBlock): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  for (const text of collectStrings(block.props)) {
    const hits = findForbiddenPhrases(text);
    for (const phrase of hits) {
      warnings.push({
        blockId: block.id,
        code: "forbidden_phrase",
        message: `Block contains forbidden phrase: "${phrase}".`,
        severity: "error",
      });
    }
  }
  return warnings;
}

function validateBlock(block: PageBlock, depth = 0): ValidationWarning[] {
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

  warnings.push(...validateForbiddenCopy(block));

  if (block.type === "hero") {
    if (!asString(block.props.headline)) {
      warnings.push({
        blockId: block.id,
        code: "hero_missing_headline",
        message: "Hero block requires a headline.",
        severity: "error",
      });
    }
    warnings.push(
      ...validateCta(block, "hero_invalid_primary_cta", "primaryCtaLabel", "primaryCtaHref", "Hero primary CTA"),
      ...validateCta(block, "hero_invalid_secondary_cta", "secondaryCtaLabel", "secondaryCtaHref", "Hero secondary CTA"),
    );
  }

  if (block.type === "cta_band") {
    if (!asString(block.props.title)) {
      warnings.push({
        blockId: block.id,
        code: "cta_missing_title",
        message: "CTA band requires a title.",
        severity: "error",
      });
    }
    warnings.push(...validateCta(block, "cta_invalid_href", "ctaLabel", "ctaHref", "CTA band button"));
  }

  if (block.type === "text_section") {
    if (!asString(block.props.title) && !asString(block.props.body)) {
      warnings.push({
        blockId: block.id,
        code: "text_empty",
        message: "Text section requires a title or body.",
        severity: "error",
      });
    }
  }

  if (block.type === "image_banner") {
    if (!asString(block.props.imageUrl)) {
      warnings.push({
        blockId: block.id,
        code: "image_missing_url",
        message: "Image banner requires imageUrl.",
        severity: "error",
      });
    }
    if (!asString(block.props.alt)) {
      warnings.push({
        blockId: block.id,
        code: "image_missing_alt",
        message: "Image banner requires alt text.",
        severity: "error",
      });
    }
  }

  if (block.type === "feature_grid") {
    if (!asString(block.props.title)) {
      warnings.push({
        blockId: block.id,
        code: "feature_grid_missing_title",
        message: "Feature grid requires a section title.",
        severity: "error",
      });
    }
    const items = block.props.items;
    if (!Array.isArray(items) || items.length === 0) {
      warnings.push({
        blockId: block.id,
        code: "feature_grid_empty",
        message: "Feature grid requires at least one item.",
        severity: "error",
      });
    }
  }

  if (block.type === "testimonial") {
    if (!asString(block.props.quote)) {
      warnings.push({
        blockId: block.id,
        code: "testimonial_missing_quote",
        message: "Testimonial requires a quote.",
        severity: "error",
      });
    }
    if (!asString(block.props.name)) {
      warnings.push({
        blockId: block.id,
        code: "testimonial_missing_name",
        message: "Testimonial requires a name.",
        severity: "error",
      });
    }
    if (!asString(block.props.title)) {
      warnings.push({
        blockId: block.id,
        code: "testimonial_missing_title",
        message: "Testimonial requires a title or company.",
        severity: "error",
      });
    }
    const avatarUrl = asString(block.props.avatarUrl);
    if (avatarUrl && !asString(block.props.avatarAlt)) {
      warnings.push({
        blockId: block.id,
        code: "testimonial_missing_avatar_alt",
        message: "Testimonial avatar requires alt text when an image URL is set.",
        severity: "error",
      });
    }
    const rating = block.props.rating;
    if (rating !== undefined && rating !== null && rating !== "") {
      const num = Number(rating);
      if (Number.isNaN(num) || num < 0 || num > 5) {
        warnings.push({
          blockId: block.id,
          code: "testimonial_invalid_rating",
          message: "Testimonial rating must be between 0 and 5.",
          severity: "warning",
        });
      }
    }
  }

  if (block.type === "faq") {
    if (!asString(block.props.title)) {
      warnings.push({
        blockId: block.id,
        code: "faq_missing_title",
        message: "FAQ block requires a section title.",
        severity: "error",
      });
    }
    const items = block.props.items;
    if (!Array.isArray(items) || items.length === 0) {
      warnings.push({
        blockId: block.id,
        code: "faq_empty",
        message: "FAQ block requires at least one question.",
        severity: "error",
      });
    } else {
      for (const [index, item] of items.entries()) {
        const row = item as { question?: string; answer?: string };
        if (!asString(row.question) || !asString(row.answer)) {
          warnings.push({
            blockId: block.id,
            code: "faq_item_incomplete",
            message: `FAQ item ${index + 1} requires both question and answer.`,
            severity: "error",
          });
        }
      }
    }
  }

  if (block.type === "process_steps") {
    if (!asString(block.props.title)) {
      warnings.push({
        blockId: block.id,
        code: "process_steps_missing_title",
        message: "Process steps block requires a title.",
        severity: "error",
      });
    }
    const steps = block.props.steps;
    if (!Array.isArray(steps) || steps.length < 3 || steps.length > 6) {
      warnings.push({
        blockId: block.id,
        code: "process_steps_count",
        message: "Process steps block requires 3 to 6 steps.",
        severity: "error",
      });
    } else {
      for (const [index, step] of steps.entries()) {
        const row = step as { title?: string; description?: string };
        if (!asString(row.title) || !asString(row.description)) {
          warnings.push({
            blockId: block.id,
            code: "process_step_incomplete",
            message: `Process step ${index + 1} requires a title and description.`,
            severity: "error",
          });
        }
      }
    }
  }

  if (block.type === "pricing_plan") {
    if (!asString(block.props.planName)) {
      warnings.push({
        blockId: block.id,
        code: "pricing_missing_name",
        message: "Pricing plan requires a plan name.",
        severity: "error",
      });
    }
    if (!asString(block.props.priceLabel)) {
      warnings.push({
        blockId: block.id,
        code: "pricing_missing_price",
        message: "Pricing plan requires a price label.",
        severity: "error",
      });
    }
    const features = block.props.features;
    if (!Array.isArray(features) || features.length === 0 || features.every((f) => !asString(String(f)))) {
      warnings.push({
        blockId: block.id,
        code: "pricing_missing_features",
        message: "Pricing plan requires at least one feature.",
        severity: "error",
      });
    }
    warnings.push(...validateCta(block, "pricing_invalid_cta", "ctaLabel", "ctaHref", "Pricing plan CTA"));
  }

  if (block.type === "compliance_notice") {
    if (!asString(block.props.title)) {
      warnings.push({
        blockId: block.id,
        code: "compliance_missing_title",
        message: "Compliance notice requires a title.",
        severity: "error",
      });
    }
    if (!asString(block.props.body)) {
      warnings.push({
        blockId: block.id,
        code: "compliance_missing_body",
        message: "Compliance notice requires body text.",
        severity: "error",
      });
    }
  }

  if (block.type === "team") {
    if (!asString(block.props.name)) {
      warnings.push({
        blockId: block.id,
        code: "team_missing_name",
        message: "Team block requires a name.",
        severity: "error",
      });
    }
    if (!asString(block.props.title)) {
      warnings.push({
        blockId: block.id,
        code: "team_missing_title",
        message: "Team block requires a title.",
        severity: "error",
      });
    }
    if (!asString(block.props.bio)) {
      warnings.push({
        blockId: block.id,
        code: "team_missing_bio",
        message: "Team block requires a bio.",
        severity: "error",
      });
    }
    if (!asString(block.props.imageUrl)) {
      warnings.push({
        blockId: block.id,
        code: "team_missing_image",
        message: "Team block requires an image URL.",
        severity: "error",
      });
    }
    if (!asString(block.props.imageAlt)) {
      warnings.push({
        blockId: block.id,
        code: "team_missing_alt",
        message: "Team block requires image alt text.",
        severity: "error",
      });
    }
    const linkedIn = asString(block.props.linkedInUrl);
    if (linkedIn && !linkedIn.startsWith("https://")) {
      warnings.push({
        blockId: block.id,
        code: "team_invalid_linkedin",
        message: "LinkedIn URL must use https.",
        severity: "error",
      });
    }
  }

  if (block.type === "logo_cloud") {
    if (!asString(block.props.title)) {
      warnings.push({
        blockId: block.id,
        code: "logo_cloud_missing_title",
        message: "Logo cloud requires a section title.",
        severity: "error",
      });
    }
    const logos = block.props.logos;
    if (!Array.isArray(logos) || logos.length === 0) {
      warnings.push({
        blockId: block.id,
        code: "logo_cloud_empty",
        message: "Logo cloud requires at least one logo.",
        severity: "error",
      });
    } else {
      for (const [index, logo] of logos.entries()) {
        const row = logo as { imageUrl?: string; alt?: string };
        if (!asString(row.imageUrl) || !asString(row.alt)) {
          warnings.push({
            blockId: block.id,
            code: "logo_cloud_item_invalid",
            message: `Logo ${index + 1} requires imageUrl and alt text.`,
            severity: "error",
          });
        }
      }
    }
  }

  if (block.type === "stats_comparison") {
    if (!asString(block.props.title)) {
      warnings.push({
        blockId: block.id,
        code: "stats_comparison_missing_title",
        message: "Stats comparison requires a title.",
        severity: "error",
      });
    }
    const items = block.props.items;
    if (!Array.isArray(items) || items.length < 2) {
      warnings.push({
        blockId: block.id,
        code: "stats_comparison_items",
        message: "Stats comparison requires at least two metrics.",
        severity: "error",
      });
    } else {
      for (const [index, item] of items.entries()) {
        const row = item as { category?: string; label?: string; value?: string; description?: string };
        if (!asString(row.label) || !asString(row.value)) {
          warnings.push({
            blockId: block.id,
            code: "stats_comparison_item_incomplete",
            message: `Comparison item ${index + 1} requires a metric label and value.`,
            severity: "error",
          });
        }
      }
    }
  }

  if (block.type === "metric") {
    if (!asString(block.props.label)) {
      warnings.push({
        blockId: block.id,
        code: "metric_missing_label",
        message: "Metric block requires a label.",
        severity: "error",
      });
    }
    if (!asString(block.props.value)) {
      warnings.push({
        blockId: block.id,
        code: "metric_missing_value",
        message: "Metric block requires a value.",
        severity: "error",
      });
    }
  }

  if (isLayoutBlockType(block.type)) {
    if (depth > 0) {
      warnings.push({
        blockId: block.id,
        code: "nested_layout_forbidden",
        message: "Layout blocks cannot be nested inside other layout regions.",
        severity: "error",
      });
    }

    for (const region of getLayoutRegionDescriptors(block)) {
      const children = getRegionBlocks(block, region.key);
      if (children.length === 0) {
        warnings.push({
          blockId: block.id,
          code: "layout_region_empty",
          message: `${region.label} is empty — add at least one content block.`,
          severity: "warning",
        });
      }

      for (const child of children) {
        if (isLayoutBlockType(child.type)) {
          warnings.push({
            blockId: child.id,
            code: "nested_layout_forbidden",
            message: "Layout blocks cannot be placed inside layout regions.",
            severity: "error",
          });
        } else if (!canPlaceInLayoutRegion(child.type)) {
          warnings.push({
            blockId: child.id,
            code: "invalid_region_child",
            message: `Block type "${child.type}" is not allowed inside layout regions.`,
            severity: "error",
          });
        }
        warnings.push(...validateBlock(child, depth + 1));
      }
    }
  }

  return warnings;
}

export function parseLayoutDocument(raw: unknown): PageLayoutDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as PageLayoutDocument;
  if (doc.version !== 1 || !Array.isArray(doc.blocks)) return null;
  if (doc.pageSlug && !(PAGE_BUILDER_SLUGS as readonly string[]).includes(String(doc.pageSlug))) {
    return { ...doc, pageSlug: doc.pageSlug };
  }
  return doc;
}

export { isValidCtaHref as isValidHref };
