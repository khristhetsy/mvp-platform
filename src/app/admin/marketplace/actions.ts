"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { slugify } from "@/lib/marketplace/validation";
import { notifyInterestListOfferingLive } from "@/lib/marketplace/interest-emails";

export type ReviewResult = { ok: true } | { ok: false; error: string };

async function requireReviewer(): Promise<{ userId: string } | { error: string }> {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return { error: "Staff access required." };
  return { userId: auth.profile.id };
}

/** Approve a pending listing → live. Generates the immutable slug + publish timestamp. */
export async function approveListing(listingId: string): Promise<ReviewResult> {
  const r = await requireReviewer();
  if ("error" in r) return { ok: false, error: r.error };

  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { data: listing } = await admin
    .from("marketplace_listings")
    .select("id, status, slug, company_name")
    .eq("id", listingId)
    .maybeSingle();
  const row = listing as { id: string; status: string; slug: string | null; company_name: string } | null;
  if (!row) return { ok: false, error: "Listing not found." };
  if (row.status === "live") return { ok: false, error: "Listing is already live." };

  const now = new Date().toISOString();
  const slug = row.slug ?? slugify(row.company_name, row.id);
  const { error } = await admin
    .from("marketplace_listings")
    .update({
      status: "live",
      slug,
      published_at: now,
      reviewed_by: r.userId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", listingId);
  if (error) {
    // Exclusion constraint: founder already has a live listing.
    if (error.message.toLowerCase().includes("one_live_listing")) {
      return { ok: false, error: "This company already has a live listing. Pause it before publishing another." };
    }
    return { ok: false, error: error.message };
  }

  await writeAuditLog(admin, {
    userId: r.userId,
    action: "marketplace.listing_approved",
    entityType: "marketplace_listing",
    entityId: listingId,
    metadata: { slug },
  });
  return { ok: true };
}

/** Reject a pending listing → rejected. */
export async function rejectListing(listingId: string): Promise<ReviewResult> {
  const r = await requireReviewer();
  if ("error" in r) return { ok: false, error: r.error };

  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("marketplace_listings")
    .update({ status: "rejected", reviewed_by: r.userId, reviewed_at: now, updated_at: now })
    .eq("id", listingId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(admin, {
    userId: r.userId,
    action: "marketplace.listing_rejected",
    entityType: "marketplace_listing",
    entityId: listingId,
    metadata: {},
  });
  return { ok: true };
}

export type NotifyInterestResult =
  | { ok: true; intended: number; sent: number; live: boolean }
  | { ok: false; error: string };

/**
 * Notify a live listing's interest list that the offering is live on its portal.
 * Email delivery is gated (MARKETPLACE_INTEREST_EMAILS_LIVE) and counsel-pending;
 * until enabled this reports the intended count without sending.
 */
export async function notifyInterestList(listingId: string): Promise<NotifyInterestResult> {
  const r = await requireReviewer();
  if ("error" in r) return { ok: false, error: r.error };

  try {
    const result = await notifyInterestListOfferingLive(listingId);
    const admin = createServiceRoleClient() as unknown as SupabaseClient;
    await writeAuditLog(admin, {
      userId: r.userId,
      action: "marketplace.interest_list_notified",
      entityType: "marketplace_listing",
      entityId: listingId,
      metadata: { intended: result.intended, sent: result.sent, live: result.live },
    });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Notify failed." };
  }
}
