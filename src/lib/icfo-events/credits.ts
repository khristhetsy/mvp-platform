// iCFO Credits — a closed-loop, no-cash-value loyalty ledger. Credits are earned
// 1:1 from gamification points and redeemed for a fixed catalog of iCFO services.
// They are NOT money, a security, or redeemable for cash. All mutations run under
// the service role; users only ever read their own rows (enforced by RLS).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Program feature flag. Keep off until counsel signs off; page + nav stay hidden. */
export const CREDITS_ENABLED = process.env.CREDITS_ENABLED === "true";

function raw(supabase: SupabaseClient): SupabaseClient {
  return supabase;
}
type Row = Record<string, unknown>;

export interface CreditEntry {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
  eventId: string | null;
}
export interface CreditItem {
  id: string;
  title: string;
  description: string | null;
  cost: number;
  active: boolean;
  sort: number;
}
export interface CreditRedemption {
  id: string;
  profileId: string;
  itemId: string;
  title: string;
  cost: number;
  status: string;
  createdAt: string;
}

function mapEntry(r: Row): CreditEntry {
  return {
    id: String(r.id),
    delta: Number(r.delta ?? 0),
    reason: String(r.reason ?? ""),
    createdAt: String(r.created_at),
    eventId: (r.event_id as string | null) ?? null,
  };
}
function mapItem(r: Row): CreditItem {
  return {
    id: String(r.id),
    title: String(r.title),
    description: (r.description as string | null) ?? null,
    cost: Number(r.cost ?? 0),
    active: Boolean(r.active),
    sort: Number(r.sort ?? 0),
  };
}
function mapRedemption(r: Row): CreditRedemption {
  return {
    id: String(r.id),
    profileId: String(r.profile_id),
    itemId: String(r.item_id),
    title: String(r.title),
    cost: Number(r.cost ?? 0),
    status: String(r.status ?? "fulfilled"),
    createdAt: String(r.created_at),
  };
}

/**
 * Grant credits to a user. Idempotent on (profile_id, reason, ref) so retries and
 * re-fired actions never double-credit. Best-effort — never throws, so it can be
 * called from any action handler without risk to the primary action.
 */
export async function awardCredits(
  profileId: string,
  amount: number,
  reason: string,
  ref = "",
  opts: { eventId?: string | null; expiresAt?: string | null } = {},
): Promise<void> {
  if (!CREDITS_ENABLED || amount <= 0 || !profileId) return;
  try {
    const admin = createServiceRoleClient() as unknown as SupabaseClient;
    await raw(admin)
      .from("credit_ledger")
      .upsert(
        {
          profile_id: profileId,
          delta: amount,
          reason,
          ref,
          event_id: opts.eventId ?? null,
          expires_at: opts.expiresAt ?? null,
        },
        { onConflict: "profile_id,reason,ref", ignoreDuplicates: true },
      );
  } catch {
    // swallow — credits must never block the primary action
  }
}

/** Current balance = sum of all ledger deltas for the profile. */
export async function getBalance(supabase: SupabaseClient<Database>, profileId: string): Promise<number> {
  const { data } = await raw(supabase as unknown as SupabaseClient)
    .from("credit_ledger")
    .select("delta")
    .eq("profile_id", profileId);
  return ((data ?? []) as Row[]).reduce((s, r) => s + Number(r.delta ?? 0), 0);
}

export async function getLedger(
  supabase: SupabaseClient<Database>,
  profileId: string,
  limit = 50,
): Promise<CreditEntry[]> {
  const { data } = await raw(supabase as unknown as SupabaseClient)
    .from("credit_ledger")
    .select("id, delta, reason, created_at, event_id")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map(mapEntry);
}

export async function listCatalog(
  supabase: SupabaseClient<Database>,
  activeOnly = true,
): Promise<CreditItem[]> {
  const base = raw(supabase as unknown as SupabaseClient).from("credit_catalog").select("*");
  const filtered = activeOnly ? base.eq("active", true) : base;
  const { data } = await filtered.order("sort", { ascending: true });
  return ((data ?? []) as Row[]).map(mapItem);
}

/**
 * Redeem a catalog item. Verifies the item is active and the balance covers the
 * cost, records a redemption, then burns credits with a matching ledger entry.
 * Runs under the service role.
 */
export async function redeem(
  profileId: string,
  itemId: string,
): Promise<{ ok: true; redemptionId: string; balance: number } | { ok: false; error: string }> {
  if (!CREDITS_ENABLED) return { ok: false, error: "Points are not enabled." };
  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  const { data: itemRow } = await raw(admin).from("credit_catalog").select("*").eq("id", itemId).maybeSingle();
  if (!itemRow) return { ok: false, error: "That item is unavailable." };
  const item = mapItem(itemRow as Row);
  if (!item.active) return { ok: false, error: "That item is no longer available." };

  const balance = await getBalance(admin as unknown as SupabaseClient<Database>, profileId);
  if (balance < item.cost) return { ok: false, error: "Not enough Points." };

  const { data: redRow, error: redErr } = await raw(admin)
    .from("credit_redemptions")
    .insert({ profile_id: profileId, item_id: item.id, title: item.title, cost: item.cost })
    .select("id")
    .single();
  if (redErr || !redRow) return { ok: false, error: "Couldn't record the redemption." };
  const redemptionId = String((redRow as Row).id);

  const { error: ledErr } = await raw(admin).from("credit_ledger").insert({
    profile_id: profileId,
    delta: -item.cost,
    reason: "redeem",
    ref: redemptionId,
    redemption_id: redemptionId,
  });
  if (ledErr) {
    // Roll back the redemption record if the burn failed.
    await raw(admin).from("credit_redemptions").delete().eq("id", redemptionId);
    return { ok: false, error: "Couldn't debit Points — please try again." };
  }

  return { ok: true, redemptionId, balance: balance - item.cost };
}

// ── admin catalog management ────────────────────────────────────────────────
export async function createCatalogItem(
  supabase: SupabaseClient<Database>,
  input: { title: string; description?: string | null; cost: number; sort?: number },
): Promise<CreditItem> {
  const { data, error } = await raw(supabase as unknown as SupabaseClient)
    .from("credit_catalog")
    .insert({ title: input.title, description: input.description ?? null, cost: input.cost, sort: input.sort ?? 0 })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapItem(data as Row);
}

export async function updateCatalogItem(
  supabase: SupabaseClient<Database>,
  id: string,
  patch: { title?: string; description?: string | null; cost?: number; active?: boolean; sort?: number },
): Promise<CreditItem> {
  const p: Record<string, unknown> = {};
  if (patch.title !== undefined) p.title = patch.title;
  if (patch.description !== undefined) p.description = patch.description;
  if (patch.cost !== undefined) p.cost = patch.cost;
  if (patch.active !== undefined) p.active = patch.active;
  if (patch.sort !== undefined) p.sort = patch.sort;
  const { data, error } = await raw(supabase as unknown as SupabaseClient)
    .from("credit_catalog")
    .update(p)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapItem(data as Row);
}

export async function listRedemptions(
  supabase: SupabaseClient<Database>,
  limit = 50,
): Promise<CreditRedemption[]> {
  const { data } = await raw(supabase as unknown as SupabaseClient)
    .from("credit_redemptions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map(mapRedemption);
}

/** Human label for a ledger reason code (for the wallet history list). */
export function reasonLabel(reason: string): string {
  if (reason.startsWith("earn:")) {
    const a = reason.slice(5);
    const map: Record<string, string> = {
      register: "Registered for an event",
      session_viewed: "Watched a session",
      applied: "Applied to present",
      approved: "Approved to present",
      networking_optin: "Opted into networking",
      connection_accepted: "Accepted a connection",
    };
    return map[a] ?? "Earned";
  }
  if (reason === "redeem") return "Redeemed a reward";
  if (reason === "expire") return "Points expired";
  if (reason === "reversal") return "Reversal";
  if (reason === "adjust") return "Adjustment";
  return reason;
}
