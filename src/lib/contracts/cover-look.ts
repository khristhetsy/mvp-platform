import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { effectiveSignature, loadSignature } from "@/lib/email/signature";
import { EMAIL_BRAND } from "@/lib/email/brand";
import { toICapOSSignature, withDisclaimer, type CoverBrand, type CoverLook, type CoverStyle } from "./cover-signature";

/**
 * The sender's saved signature (Settings, or the iCFO template when none is
 * saved), set for the chosen company, with the iCFO disclaimer guaranteed.
 * Service-role read keyed by the sender's own profile id, like the signature API.
 */
export async function resolveCoverLook(senderId: string, brand: CoverBrand = "icfo", style: CoverStyle = "plain"): Promise<CoverLook> {
  let saved = "";
  try {
    saved = await loadSignature(createServiceRoleClient(), senderId);
  } catch {
    saved = "";
  }
  const base = effectiveSignature(saved);
  const signatureHtml = withDisclaimer(brand === "icapos" ? toICapOSSignature(base, EMAIL_BRAND.logoUrl) : base);
  return { brand, style, signatureHtml };
}
