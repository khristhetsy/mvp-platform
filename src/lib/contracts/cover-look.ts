import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { resolveSignature } from "@/lib/email/signature";
import { EMAIL_BRAND } from "@/lib/email/brand";
import { toICapOSSignature, withDisclaimer, type CoverBrand, type CoverLook, type CoverStyle } from "./cover-signature";

/**
 * The sender's saved signature (Settings, or one built from their own details
 * when none is saved), set for the chosen company, with the iCFO disclaimer guaranteed.
 * Service-role read keyed by the sender's own profile id, like the signature API.
 */
export async function resolveCoverLook(senderId: string, brand: CoverBrand = "icfo", style: CoverStyle = "plain"): Promise<CoverLook> {
  let base = "";
  try {
    const db = createServiceRoleClient();
    const { data: sender } = await db.from("profiles").select("id, full_name, email").eq("id", senderId).maybeSingle();
    base = await resolveSignature(db, { id: senderId, full_name: sender?.full_name ?? null, email: sender?.email ?? null });
  } catch {
    base = "";
  }
  const signatureHtml = withDisclaimer(brand === "icapos" ? toICapOSSignature(base, EMAIL_BRAND.logoUrl) : base);
  return { brand, style, signatureHtml };
}
