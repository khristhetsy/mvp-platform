import { z } from "zod";
import { isAllowlistedPortalUrl } from "./portal-allowlist";
import { findProhibitedTerms } from "./prohibited-terms";

// Founder-supplied listing input. Tombstone-safe fields only; no pitch content.
export const listingInputSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  briefDescription: z.string().trim().min(10).max(280),
  industry: z.string().trim().max(80).optional().or(z.literal("")),
  location: z.string().trim().max(80).optional().or(z.literal("")),
  securityType: z.string().trim().max(60).optional().or(z.literal("")),
  offeringAmountMin: z.number().nonnegative().nullable().optional(),
  offeringAmountMax: z.number().nonnegative().nullable().optional(),
  portalName: z.string().trim().min(2).max(80),
  portalUrl: z.string().trim().url().max(500),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

/** Slug generated at publish time: company name + 6-char id suffix. Immutable after. */
export function slugify(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = id.replace(/-/g, "").slice(0, 6);
  return `${base}-${suffix}`;
}

export type ListingValidation = {
  ok: boolean;
  errors: string[];
  /** Non-allowlisted portal → route to pending_review with a flag (not a hard fail). */
  portalFlagged: boolean;
};

export function validateListing(input: ListingInput): ListingValidation {
  const errors: string[] = [];

  const prohibited = findProhibitedTerms(input.briefDescription);
  if (prohibited.length > 0) {
    errors.push(`Description contains prohibited language: ${prohibited.join(", ")}. Tombstone notices state facts only.`);
  }

  const portal = isAllowlistedPortalUrl(input.portalUrl);
  if (!portal.https) errors.push("Portal URL must use https.");

  if (
    input.offeringAmountMin != null &&
    input.offeringAmountMax != null &&
    input.offeringAmountMax < input.offeringAmountMin
  ) {
    errors.push("Maximum raise cannot be less than the minimum.");
  }

  return { ok: errors.length === 0, errors, portalFlagged: portal.https && !portal.allowlisted };
}
