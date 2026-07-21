import { z } from "zod";
import { isAllowlistedPortalUrl } from "./portal-allowlist";
import { findProhibitedTermsInFields } from "./prohibited-terms";

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

  // Every founder-supplied field that reaches the public tombstone is linted,
  // not just the description — a security type reading "Guaranteed 20% Return
  // Notes" is exactly the claim Reg CF §227.204 prohibits.
  const FIELD_LABELS: Record<string, string> = {
    companyName: "Company name",
    briefDescription: "Description",
    securityType: "Security type",
    portalName: "Portal name",
    industry: "Industry",
    location: "Location",
  };

  const prohibited = findProhibitedTermsInFields({
    companyName: input.companyName,
    briefDescription: input.briefDescription,
    securityType: input.securityType,
    portalName: input.portalName,
    industry: input.industry,
    location: input.location,
  });

  for (const hit of prohibited) {
    errors.push(
      `${FIELD_LABELS[hit.field] ?? hit.field} contains prohibited language: ${hit.terms.join(", ")}. Tombstone notices state facts only.`,
    );
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
