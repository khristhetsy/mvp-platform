// Client-safe helper: a branded template stores its link to the branded content
// as marketing_templates.blocks = { branded: { copy_id } }.

export type BrandedLink = { copy_id: string };

/** The branded link stored on a template, or null for an ordinary template. */
export function brandedLink(blocks: unknown): BrandedLink | null {
  const b = (blocks as { branded?: { copy_id?: unknown } } | null)?.branded;
  return b && typeof b.copy_id === "string" ? { copy_id: b.copy_id } : null;
}
