import crypto from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Signed per-recipient link for the free due diligence offer (the {{claim_url}}
 * merge field in the two founder lead emails). Same scheme as the testimonial
 * and unsubscribe tokens, base64url(email).hmac, with its own domain prefix so
 * a claim token is never valid as any other kind of token.
 */
const DOMAIN = "claim:";

function secret(): string {
  return process.env.MARKETING_UNSUBSCRIBE_SECRET ?? "default-secret";
}

function sign(normalized: string): string {
  return crypto.createHmac("sha256", secret()).update(DOMAIN + normalized).digest("hex").slice(0, 32);
}

export function makeClaimToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  return `${Buffer.from(normalized).toString("base64url")}.${sign(normalized)}`;
}

export function verifyClaimToken(token: string | null | undefined): string | null {
  if (!token || !token.includes(".") || token.length > 400) return null;
  const [enc, sig] = token.split(".");
  if (!enc || !sig) return null;
  let email: string;
  try {
    email = Buffer.from(enc, "base64url").toString("utf8").trim().toLowerCase();
  } catch {
    return null;
  }
  if (!email.includes("@")) return null;
  const expected = sign(email);
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? email : null;
}

export function claimUrl(email: string, appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com"): string {
  return `${appUrl}/claim?t=${makeClaimToken(email)}`;
}

/** Partner codes are 3 to 20 letters or digits, stored uppercase. */
export function normalizePartnerCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{3,20}$/.test(code) ? code : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/** An active partner code, or null. Read with the service role (public pages). */
export async function activePartner(code: string | null, db: Db = createServiceRoleClient()): Promise<{ code: string; partnerName: string } | null> {
  if (!code) return null;
  const { data } = await db.from("partner_codes").select("code, partner_name, is_active").eq("code", code).maybeSingle();
  if (!data || !data.is_active) return null;
  return { code: data.code, partnerName: data.partner_name };
}

/** The CRM founder lead behind a claim email, if any (for the claim page greeting). */
export async function leadForEmail(email: string, db: Db = createServiceRoleClient()): Promise<{ id: string; name: string | null; company: string | null } | null> {
  const { data } = await db
    .from("crm_contacts")
    .select("id, name, company, module")
    // Escape LIKE wildcards: "_" is common in emails and must match literally.
    .ilike("email", email.replace(/[\\%_]/g, (ch) => `\\${ch}`))
    .limit(5);
  const rows = (data ?? []) as Array<{ id: string; name: string | null; company: string | null; module: string | null }>;
  const founder = rows.find((r) => r.module !== "investor") ?? null;
  return founder ? { id: founder.id, name: founder.name, company: founder.company } : null;
}

/**
 * Runs once on a new founder's first profile: writes the partner code onto the
 * company and records the claim when they came from the lead email. Never
 * throws, so attribution can never fail a signup.
 */
export async function recordSignupAttribution(input: {
  userId: string;
  email: string | null;
  companyId: string | null;
  metadata: Record<string, unknown> | null | undefined;
}): Promise<void> {
  try {
    const db: Db = createServiceRoleClient();
    const meta = input.metadata ?? {};
    const partner = await activePartner(normalizePartnerCode(meta.partner_code), db);
    if (partner && input.companyId) {
      await db.from("companies").update({ partner_code: partner.code }).eq("id", input.companyId).is("partner_code", null);
    }
    const claimedEmail = verifyClaimToken(typeof meta.claim_token === "string" ? meta.claim_token : null);
    const email = (input.email ?? "").trim().toLowerCase();
    if (claimedEmail || partner) {
      const lead = email ? await leadForEmail(email, db) : null;
      await db.from("lead_claims").insert({
        email: claimedEmail ?? email,
        crm_contact_id: lead?.id ?? null,
        profile_id: input.userId,
        company_id: input.companyId,
        partner_code: partner?.code ?? null,
      });
      if (lead?.id) {
        await db.from("crm_contacts").update({ supabase_profile_id: input.userId }).eq("id", lead.id).is("supabase_profile_id", null);
      }
    }
  } catch (err) {
    console.error("[claim] attribution failed", err);
  }
}
