// iCFO Credits — a closed-loop, no-cash-value loyalty ledger. Credits are earned
// 1:1 from gamification points and redeemed for a fixed catalog of iCFO services.
// They are NOT money, a security, or redeemable for cash. All mutations run under
// the service role; users only ever read their own rows (enforced by RLS).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Program feature flag. Keep off until counsel signs off; page + nav stay hidden. */
export const CREDITS_ENABLED = process.env.CREDITS_ENABLED === "true";

/** Guardrails (all optional; 0/unset = no limit, and no extra queries run).
 *  - EXPIRY_MONTHS: earn lots expire this many months after they're earned.
 *  - USER_CAP: max Points a single member can hold (earning stops at the cap).
 *  - PROGRAM_CAP: max total outstanding Points across everyone (bounds liability). */
export const POINTS_EXPIRY_MONTHS = Number(process.env.POINTS_EXPIRY_MONTHS ?? 0) || 0;
export const POINTS_USER_CAP = Number(process.env.POINTS_USER_CAP ?? 0) || 0;
export const POINTS_PROGRAM_CAP = Number(process.env.POINTS_PROGRAM_CAP ?? 0) || 0;

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
  status: string; // 'pending' | 'fulfilled' | 'reversed'
  createdAt: string;
  attendeeName: string | null;
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
  const p = r.profiles as { full_name?: string | null; email?: string | null } | null;
  return {
    id: String(r.id),
    profileId: String(r.profile_id),
    itemId: String(r.item_id),
    title: String(r.title),
    cost: Number(r.cost ?? 0),
    status: String(r.status ?? "pending"),
    createdAt: String(r.created_at),
    attendeeName: p?.full_name ?? p?.email ?? null,
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
    let grant = amount;

    // Per-member cap: never let a balance exceed the cap (only queried if set).
    if (POINTS_USER_CAP > 0) {
      const bal = await getBalance(admin as unknown as SupabaseClient<Database>, profileId);
      grant = Math.min(grant, Math.max(0, POINTS_USER_CAP - bal));
    }
    // Program-wide cap on total outstanding Points (only queried if set).
    if (grant > 0 && POINTS_PROGRAM_CAP > 0) {
      const { data } = await raw(admin).from("credit_ledger").select("delta");
      const total = ((data ?? []) as Row[]).reduce((s, r) => s + Number(r.delta ?? 0), 0);
      grant = Math.min(grant, Math.max(0, POINTS_PROGRAM_CAP - total));
    }
    if (grant <= 0) return;

    // Default expiry for earn lots (redeem/reversal entries never expire).
    let expiresAt = opts.expiresAt ?? null;
    if (!expiresAt && POINTS_EXPIRY_MONTHS > 0 && reason.startsWith("earn")) {
      const d = new Date();
      d.setMonth(d.getMonth() + POINTS_EXPIRY_MONTHS);
      expiresAt = d.toISOString();
    }

    await raw(admin)
      .from("credit_ledger")
      .upsert(
        {
          profile_id: profileId,
          delta: grant,
          reason,
          ref,
          event_id: opts.eventId ?? null,
          expires_at: expiresAt,
        },
        { onConflict: "profile_id,reason,ref", ignoreDuplicates: true },
      );
  } catch {
    // swallow — credits must never block the primary action
  }
}

/**
 * Expire unspent Points from lots past their expiry (FIFO). Idempotent per day:
 * a member's expired-but-unspent balance is computed by replaying the ledger
 * FIFO, so re-running never double-expires. Best-effort; returns a summary.
 */
export async function runPointsExpiry(): Promise<{ usersProcessed: number; expiredTotal: number }> {
  if (!CREDITS_ENABLED || POINTS_EXPIRY_MONTHS <= 0) return { usersProcessed: 0, expiredTotal: 0 };
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const now = Date.now();
  const dayRef = `expire:${new Date().toISOString().slice(0, 10)}`;

  const { data: userRows } = await raw(admin).from("credit_ledger").select("profile_id");
  const ids = [...new Set(((userRows ?? []) as Row[]).map((r) => String(r.profile_id)))];

  let usersProcessed = 0;
  let expiredTotal = 0;
  for (const pid of ids) {
    const { data: rows } = await raw(admin)
      .from("credit_ledger")
      .select("delta, reason, expires_at, created_at")
      .eq("profile_id", pid)
      .order("created_at", { ascending: true });
    const entries = (rows ?? []) as Row[];

    // Replay FIFO: positive entries are lots (earns carry an expiry), negative
    // entries consume the oldest lots first.
    const lots: { remaining: number; expiresAt: number | null }[] = [];
    for (const e of entries) {
      const delta = Number(e.delta ?? 0);
      const reason = String(e.reason ?? "");
      if (delta > 0) {
        const exp = e.expires_at ? Date.parse(String(e.expires_at)) : null;
        lots.push({ remaining: delta, expiresAt: reason.startsWith("earn") ? exp : null });
      } else if (delta < 0) {
        let need = -delta;
        for (const lot of lots) {
          if (need <= 0) break;
          const take = Math.min(lot.remaining, need);
          lot.remaining -= take;
          need -= take;
        }
      }
    }
    const expireNow = lots
      .filter((l) => l.expiresAt !== null && (l.expiresAt as number) <= now && l.remaining > 0)
      .reduce((s, l) => s + l.remaining, 0);
    if (expireNow > 0) {
      await raw(admin).from("credit_ledger").upsert(
        { profile_id: pid, delta: -expireNow, reason: "expire", ref: dayRef },
        { onConflict: "profile_id,reason,ref", ignoreDuplicates: true },
      );
      expiredTotal += expireNow;
      usersProcessed++;
    }
  }
  return { usersProcessed, expiredTotal };
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
): Promise<
  | { ok: true; redemptionId: string; balance: number; title: string; cost: number }
  | { ok: false; error: string }
> {
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
    // status starts 'pending' — an admin fulfils (or reverses) it.
    .insert({ profile_id: profileId, item_id: item.id, title: item.title, cost: item.cost, status: "pending" })
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

  return { ok: true, redemptionId, balance: balance - item.cost, title: item.title, cost: item.cost };
}

/** Fetch one redemption (with the member's name). */
export async function getRedemption(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<CreditRedemption | null> {
  const { data } = await raw(supabase as unknown as SupabaseClient)
    .from("credit_redemptions")
    .select("*, profiles:profile_id(full_name,email)")
    .eq("id", id)
    .maybeSingle();
  return data ? mapRedemption(data as Row) : null;
}

/** Mark a redemption fulfilled (staff). */
export async function fulfillRedemption(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<CreditRedemption | null> {
  const { data } = await raw(supabase as unknown as SupabaseClient)
    .from("credit_redemptions")
    .update({ status: "fulfilled" })
    .eq("id", id)
    .neq("status", "reversed")
    .select("*, profiles:profile_id(full_name,email)")
    .maybeSingle();
  return data ? mapRedemption(data as Row) : null;
}

/** Reverse a redemption (staff): refund the Points and mark it reversed. Safe to
 *  call once — the ledger refund is idempotent on (profile_id, reason, ref). */
export async function reverseRedemption(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ ok: true; redemption: CreditRedemption } | { ok: false; error: string }> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const existing = await getRedemption(admin as unknown as SupabaseClient<Database>, id);
  if (!existing) return { ok: false, error: "Redemption not found." };
  if (existing.status === "reversed") return { ok: false, error: "Already reversed." };

  await raw(admin).from("credit_ledger").upsert(
    {
      profile_id: existing.profileId,
      delta: existing.cost,
      reason: "reversal",
      ref: id,
      redemption_id: id,
    },
    { onConflict: "profile_id,reason,ref", ignoreDuplicates: true },
  );
  const { data } = await raw(admin)
    .from("credit_redemptions")
    .update({ status: "reversed" })
    .eq("id", id)
    .select("*, profiles:profile_id(full_name,email)")
    .maybeSingle();
  return { ok: true, redemption: data ? mapRedemption(data as Row) : existing };
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
    .select("*, profiles:profile_id(full_name,email)")
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
