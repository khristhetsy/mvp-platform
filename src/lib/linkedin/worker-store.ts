// Server side of the LinkedIn sender (Step 2). The sender is a small program on the owner's
// computer. It asks what to do next, does it in its own browser, and reports back. Every
// safety rule is decided here, never in the sender, so a changed or copied sender cannot send more.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { event, pauseIfAcceptanceLow, type LinkedInAccount } from "./store";
import { pickVariant, renderInvite, type InviteVariant } from "./wording";
import { canSendInvite, warmUpDay, type AccountSafety } from "./safety";
import { DRY_RUN_HOLD_HOURS, LEASE_MINUTES, MIN_GAP_MINUTES, hashSenderKey, generateSenderKey, startOfLocalDay, retryMinutesFor, waitFromDecision, type WorkerNext } from "./worker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const COLS = "id, owner_id, label, linkedin_slug, status, paused_reason, safety_level, custom_daily_cap, custom_weekly_cap, manual_allowance, high_value_tag, warm_up_started_at, timezone, sender_key_set, worker_last_seen_at, send_on_schedule, handoff_enabled, withdraw_pending, weekly_summary";

export async function accountForKeyHash(hash: string): Promise<LinkedInAccount | null> {
  const { data } = await db().from("linkedin_accounts").select(COLS).eq("worker_key_hash", hash).maybeSingle();
  return (data as LinkedInAccount | null) ?? null;
}

/** Make or replace the sender key. The key is shown once; only its hash is kept. */
export async function issueSenderKey(accountId: string, userId: string): Promise<string> {
  const key = generateSenderKey();
  const { error } = await db().from("linkedin_accounts").update({
    worker_key_hash: hashSenderKey(key), sender_key_set: true, worker_last_seen_at: null, updated_at: new Date().toISOString(),
  }).eq("id", accountId);
  if (error) throw new Error(error.message);
  await event({ account_id: accountId, kind: "resumed", detail: "Sender key created", created_by: userId });
  return key;
}

export async function revokeSenderKey(accountId: string, userId: string): Promise<void> {
  await db().from("linkedin_accounts").update({
    worker_key_hash: null, sender_key_set: false, worker_last_seen_at: null, status: "not_connected", updated_at: new Date().toISOString(),
  }).eq("id", accountId);
  await event({ account_id: accountId, kind: "paused", detail: "Sender key removed", created_by: userId });
}

function safetyOf(a: LinkedInAccount): AccountSafety & { status: LinkedInAccount["status"]; timeZone: string } {
  return {
    level: a.safety_level, customDaily: a.custom_daily_cap, customWeekly: a.custom_weekly_cap,
    manualAllowance: a.manual_allowance, warmUpStartedAt: a.warm_up_started_at, status: a.status, timeZone: a.timezone,
  };
}

async function campaignIds(accountId: string, statuses?: string[]): Promise<string[]> {
  let q = db().from("linkedin_campaigns").select("id").eq("account_id", accountId);
  if (statuses) q = q.in("status", statuses);
  const { data } = await q.limit(500);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

async function invitesSince(ids: string[], since: Date): Promise<number> {
  if (ids.length === 0) return 0;
  const { count } = await db().from("linkedin_targets").select("id", { count: "exact", head: true }).in("campaign_id", ids).gte("invited_at", since.toISOString());
  return count ?? 0;
}

async function lastInviteAt(ids: string[]): Promise<Date | null> {
  if (ids.length === 0) return null;
  const { data } = await db().from("linkedin_targets").select("invited_at").in("campaign_id", ids).not("invited_at", "is", null).order("invited_at", { ascending: false }).limit(1);
  const v = (data?.[0] as { invited_at: string } | undefined)?.invited_at;
  return v ? new Date(v) : null;
}

/** Automatic invites sent so far today in the owner's local day. */
export async function countInvitesToday(account: LinkedInAccount, now: Date = new Date()): Promise<number> {
  return invitesSince(await campaignIds(account.id), startOfLocalDay(now, account.timezone));
}

/** What should the sender do now? At most one invite, only when every rule allows it. */
export async function nextForSender(account: LinkedInAccount, opts: { dryRun: boolean; now?: Date }): Promise<WorkerNext> {
  const now = opts.now ?? new Date();
  await db().from("linkedin_accounts").update({ worker_last_seen_at: now.toISOString() }).eq("id", account.id);

  if (account.status === "warning" || account.status === "paused") return { action: "wait", reason: "paused", retryMinutes: retryMinutesFor("paused") };
  if (!account.send_on_schedule) return { action: "wait", reason: "switched_off", retryMinutes: retryMinutesFor("switched_off") };

  // The first live run starts the warm up. A dry run never does, but is checked as if it had.
  let a = account;
  if (!a.warm_up_started_at) {
    if (!opts.dryRun) {
      await db().from("linkedin_accounts").update({ warm_up_started_at: now.toISOString() }).eq("id", a.id);
      a = { ...a, warm_up_started_at: now.toISOString() };
    } else {
      a = { ...a, warm_up_started_at: now.toISOString() };
    }
  }
  if (a.status === "not_connected") {
    if (!opts.dryRun) await db().from("linkedin_accounts").update({ status: "connected", paused_reason: null }).eq("id", a.id);
    a = { ...a, status: "connected" };
  }

  const all = await campaignIds(a.id);
  const dayStart = startOfLocalDay(now, a.timezone);
  const sentToday = await invitesSince(all, dayStart);
  const sentWeek = await invitesSince(all, new Date(now.getTime() - 7 * 86_400_000));
  const decision = canSendInvite({ account: safetyOf(a), now, sentToday, sentLast7Days: sentWeek });
  if (!decision.ok) return waitFromDecision(decision);

  const last = await lastInviteAt(all);
  if (last && now.getTime() - last.getTime() < MIN_GAP_MINUTES * 60_000) return { action: "wait", reason: "gap", retryMinutes: retryMinutesFor("gap") };

  const live = await campaignIds(a.id, ["ready", "running"]);
  if (live.length === 0) return { action: "wait", reason: "nothing_queued", retryMinutes: retryMinutesFor("nothing_queued") };

  const { data } = await db().from("linkedin_targets")
    .select("id, campaign_id, linkedin_slug, display_name")
    .in("campaign_id", live).eq("status", "queued").eq("route", "invite").not("linkedin_slug", "is", null)
    .or(`next_action_at.is.null,next_action_at.lte.${now.toISOString()}`)
    .order("updated_at", { ascending: true }).limit(10);
  const rows = (data ?? []) as Array<{ id: string; campaign_id: string; linkedin_slug: string; display_name: string | null }>;

  for (const t of rows) {
    const { data: camp } = await db().from("linkedin_campaigns").select("invite_variants, approved_at, wording_hash").eq("id", t.campaign_id).single();
    const variants = ((camp?.invite_variants ?? []) as InviteVariant[]);
    const v = pickVariant(variants);
    const text = v ? renderInvite(v.text, { name: t.display_name }) : null;
    if (!camp?.approved_at || !v || !text) {
      await db().from("linkedin_targets").update({ status: "failed", skip_reason: "wording_not_usable", updated_at: now.toISOString() }).eq("id", t.id);
      await event({ account_id: a.id, campaign_id: t.campaign_id, target_id: t.id, kind: "failed", detail: "Approved wording does not fit for this person" });
      continue;
    }
    // Reserve the person so the same invite is never handed out twice.
    const lease = new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString();
    const claimed = await db().from("linkedin_targets").update({ next_action_at: lease, variant_id: v.id, updated_at: now.toISOString() })
      .eq("id", t.id).eq("status", "queued").or(`next_action_at.is.null,next_action_at.lte.${now.toISOString()}`).select("id");
    if (!claimed.data || claimed.data.length === 0) continue;
    return { action: "invite", targetId: t.id, slug: t.linkedin_slug, text, variantId: v.id, contactName: t.display_name };
  }
  return { action: "wait", reason: "nothing_queued", retryMinutes: retryMinutesFor("nothing_queued") };
}

export type SenderOutcome = "sent" | "dry_run" | "already_connected" | "not_found" | "failed" | "warning";

/** The sender reports what happened. A warning of any kind stops everything on the account. */
export async function recordResult(account: LinkedInAccount, input: { targetId: string; outcome: SenderOutcome; detail?: string | null; now?: Date }): Promise<{ paused: boolean }> {
  const now = input.now ?? new Date();
  const t = await db().from("linkedin_targets").select("id, campaign_id, status").eq("id", input.targetId).maybeSingle();
  const target = t.data as { id: string; campaign_id: string; status: string } | null;
  if (!target) return { paused: false };
  const camp = await db().from("linkedin_campaigns").select("id, account_id").eq("id", target.campaign_id).maybeSingle();
  if (!camp.data || camp.data.account_id !== account.id) return { paused: false }; // not this account's person
  const base = { account_id: account.id, campaign_id: target.campaign_id, target_id: target.id };
  const detail = (input.detail ?? "").slice(0, 300) || null;

  switch (input.outcome) {
    case "dry_run": {
      const hold = new Date(now.getTime() + DRY_RUN_HOLD_HOURS * 3_600_000).toISOString();
      await db().from("linkedin_targets").update({ next_action_at: hold, updated_at: now.toISOString() }).eq("id", target.id);
      await event({ ...base, kind: "queued", detail: `Dry run: invite was filled in, not sent${detail ? ` (${detail})` : ""}` });
      return { paused: false };
    }
    case "sent": {
      await db().from("linkedin_targets").update({ status: "invited", invited_at: now.toISOString(), next_action_at: null, updated_at: now.toISOString() }).eq("id", target.id).eq("status", "queued");
      await db().from("linkedin_campaigns").update({ status: "running", updated_at: now.toISOString() }).eq("id", target.campaign_id).in("status", ["ready"]);
      await event({ ...base, kind: "invite_sent", detail });
      await pauseIfAcceptanceLow(target.campaign_id);
      return { paused: false };
    }
    case "already_connected": {
      // Already connected people get a message, not an invite (Step 3 reads the rest).
      await db().from("linkedin_targets").update({ route: "message", next_action_at: null, updated_at: now.toISOString() }).eq("id", target.id);
      await event({ ...base, kind: "queued", detail: "Already connected, moved to message" });
      return { paused: false };
    }
    case "not_found": {
      await db().from("linkedin_targets").update({ status: "failed", skip_reason: "profile_not_found", next_action_at: null, updated_at: now.toISOString() }).eq("id", target.id);
      await event({ ...base, kind: "failed", detail: detail ?? "Profile not found" });
      return { paused: false };
    }
    case "failed": {
      // One unexplained failure is released for later. It is never retried in a loop.
      await db().from("linkedin_targets").update({ next_action_at: new Date(now.getTime() + 24 * 3_600_000).toISOString(), updated_at: now.toISOString() }).eq("id", target.id);
      await event({ ...base, kind: "failed", detail });
      return { paused: false };
    }
    case "warning": {
      await db().from("linkedin_targets").update({ next_action_at: null, updated_at: now.toISOString() }).eq("id", target.id);
      await db().from("linkedin_accounts").update({ status: "warning", paused_reason: detail ?? "LinkedIn showed a warning", updated_at: now.toISOString() }).eq("id", account.id);
      await event({ ...base, kind: "warning", detail });
      return { paused: true };
    }
  }
}

export { warmUpDay };
