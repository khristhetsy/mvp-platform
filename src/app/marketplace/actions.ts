"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { track } from "@/lib/analytics/posthog";
import { marketplaceCopy } from "@/lib/marketplace/copy";
import { expressInterestSchema, type ExpressInterestInput } from "@/lib/marketplace/express-interest-schema";

const IP_RATE_LIMIT = 5; // max submissions per ip_hash per hour
const DEDUPE_HOURS = 24; // max 1 per (email, listing) per 24h

async function ipHash(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const daySalt = new Date().toISOString().slice(0, 10);
  const secret = process.env.INTEREST_IP_SALT ?? "icapos";
  return createHash("sha256").update(`${ip}:${daySalt}:${secret}`).digest("hex");
}

/**
 * Record a non-binding indication of interest. Public, unauthenticated.
 * Silently succeeds on honeypot hits and (email, listing) duplicates so the UI
 * never leaks whether an email already expressed interest.
 */
export async function submitExpressInterest(
  input: ExpressInterestInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = expressInterestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? marketplaceCopy.expressInterest.genericError };
  }
  const data = parsed.data;

  // Honeypot: bots fill `website`. Pretend success, write nothing.
  if (data.website && data.website.length > 0) return { ok: true };

  const db = createServiceRoleClient() as unknown as SupabaseClient;

  // Listing must exist AND be live.
  const { data: listing } = await db
    .from("marketplace_listings")
    .select("id, status")
    .eq("id", data.listingId)
    .maybeSingle();
  if (!listing || (listing as { status: string }).status !== "live") {
    return { ok: false, error: marketplaceCopy.expressInterest.closedError };
  }

  const hash = await ipHash();

  // Rate limit: max 5 per ip_hash per hour.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await db
    .from("listing_interest")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", hash)
    .gte("created_at", hourAgo);
  if (typeof recentCount === "number" && recentCount >= IP_RATE_LIMIT) {
    return { ok: false, error: marketplaceCopy.expressInterest.genericError };
  }

  // Dedupe: 1 per (email, listing) per 24h → silently succeed, write nothing.
  const dayAgo = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: existing } = await db
    .from("listing_interest")
    .select("id")
    .eq("listing_id", data.listingId)
    .eq("email", data.email.toLowerCase())
    .gte("created_at", dayAgo)
    .limit(1);
  if ((existing ?? []).length > 0) return { ok: true };

  const { error } = await db.from("listing_interest").insert({
    listing_id: data.listingId,
    full_name: data.fullName,
    email: data.email.toLowerCase(),
    intended_amount_text: data.intendedAmount ? data.intendedAmount : null,
    source: "marketplace_card",
    ip_hash: hash,
  });
  if (error) return { ok: false, error: marketplaceCopy.expressInterest.genericError };

  try {
    track("marketplace_interest_submitted", { listingId: data.listingId });
  } catch {
    /* best-effort */
  }
  return { ok: true };
}
