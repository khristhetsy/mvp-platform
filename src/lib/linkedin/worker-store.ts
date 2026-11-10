// Server side of the LinkedIn sender (Step 2). The sender is a small program on the owner's
// computer. It asks what to do next, does it in its own browser, and reports back. Every
// safety rule is decided here, never in the sender, so a changed or copied sender cannot send more.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { event, pauseIfAcceptanceLow, type LinkedInAccount } from "./store";
import { handoffLink, pickVariant, renderConnectedMessage, renderInvite, type InviteVariant } from "./wording";
import { afterFailedRead, afterRead, canReadNow, cleanSlug, isNetworkAudience, matchesTitles, readNetworkFilters, readProgress } from "./network";
import { canSendInvite, canSendMessage, warmUpDay, type AccountSafety } from "./safety";
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

/** Messages to existing connections sent so far in the window. */
async function messagesSince(ids: string[], since: Date): Promise<number> {
  if (ids.length === 0) return 0;
  const { count } = await db().from("linkedin_targets").select("id", { count: "exact", head: true }).in("campaign_id", ids).gte("messaged_at", since.toISOString());
  return count ?? 0;
}

async function lastMessageAt(ids: string[]): Promise<Date | null> {
  if (ids.length === 0) return null;
  const { data } = await db().from("linkedin_targets").select("messaged_at").in("campaign_id", ids).not("messaged_at", "is", null).order("messaged_at", { ascending: false }).limit(1);
  const v = (data?.[0] as { messaged_at: string } | undefined)?.messaged_at;
  return v ? new Date(v) : null;
}

/** What should the sender do now? At most one action: an invite, or a message to an existing connection. Only when every rule allows it. */
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
  const inviteDecision = canSendInvite({ account: safetyOf(a), now, sentToday, sentLast7Days: sentWeek });
  // Pause, not started and working hours stop everything. A reached cap only stops invites.
  if (!inviteDecision.ok && inviteDecision.reason !== "daily_cap" && inviteDecision.reason !== "weekly_cap") return waitFromDecision(inviteDecision);
  const messageDecision = canSendMessage({ account: safetyOf(a), now, sentToday: await messagesSince(all, dayStart) });

  // One minimum gap for every kind of action on the account.
  const lastInvite = await lastInviteAt(all);
  const lastMessage = await lastMessageAt(all);
  const last = [lastInvite, lastMessage].filter((d): d is Date => d !== null).sort((x, y) => y.getTime() - x.getTime())[0] ?? null;
  if (last && now.getTime() - last.getTime() < MIN_GAP_MINUTES * 60_000) return { action: "wait", reason: "gap", retryMinutes: retryMinutesFor("gap") };

  const capWait: WorkerNext | null = inviteDecision.ok ? null : waitFromDecision(inviteDecision);
  const live = await campaignIds(a.id, ["ready", "running"]);
  if (live.length === 0) return capWait ?? { action: "wait", reason: "nothing_queued", retryMinutes: retryMinutesFor("nothing_queued") };

  const due = `next_action_at.is.null,next_action_at.lte.${now.toISOString()}`;

  if (inviteDecision.ok) {
    const { data } = await db().from("linkedin_targets")
      .select("id, campaign_id, linkedin_slug, display_name")
      .in("campaign_id", live).eq("status", "queued").eq("route", "invite").not("linkedin_slug", "is", null)
      .or(due)
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
        .eq("id", t.id).eq("status", "queued").or(due).select("id");
      if (!claimed.data || claimed.data.length === 0) continue;
      return { action: "invite", targetId: t.id, slug: t.linkedin_slug, text, variantId: v.id, contactName: t.display_name };
    }
  }

  // People already connected get a message, never an invite. Only campaigns with approved text for them take part.
  if (messageDecision.ok) {
    const { data: mc } = await db().from("linkedin_campaigns").select("id, connected_message_text, handoff_mode, agent").in("id", live).not("approved_at", "is", null).not("connected_message_text", "is", null);
    const campaigns = new Map(((mc ?? []) as Array<{ id: string; connected_message_text: string; handoff_mode: string; agent: "johnny" | "jessica" }>)
      .filter((c) => c.connected_message_text.trim().length > 0).map((c) => [c.id, c] as const));
    if (campaigns.size > 0) {
      const { data } = await db().from("linkedin_targets")
        .select("id, campaign_id, linkedin_slug, display_name")
        .in("campaign_id", [...campaigns.keys()]).eq("status", "queued").eq("route", "message").not("linkedin_slug", "is", null)
        .or(due)
        .order("updated_at", { ascending: true }).limit(10);
      const rows = (data ?? []) as Array<{ id: string; campaign_id: string; linkedin_slug: string; display_name: string | null }>;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://icapos.com";
      for (const t of rows) {
        const c = campaigns.get(t.campaign_id);
        if (!c) continue;
        const link = c.handoff_mode === "web_chat" ? handoffLink({ appUrl, agent: c.agent, targetId: t.id }) : null;
        const text = renderConnectedMessage(c.connected_message_text, { name: t.display_name }, link);
        if (!text) {
          await db().from("linkedin_targets").update({ status: "failed", skip_reason: "wording_not_usable", updated_at: now.toISOString() }).eq("id", t.id);
          await event({ account_id: a.id, campaign_id: t.campaign_id, target_id: t.id, kind: "failed", detail: "Approved message does not fit for this person" });
          continue;
        }
        const lease = new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString();
        const claimed = await db().from("linkedin_targets").update({ next_action_at: lease, updated_at: now.toISOString() })
          .eq("id", t.id).eq("status", "queued").or(due).select("id");
        if (!claimed.data || claimed.data.length === 0) continue;
        return { action: "message", targetId: t.id, slug: t.linkedin_slug, text, contactName: t.display_name };
      }
    }
  }
  const reading = await nextRead(a, live, now);
  if (reading) return reading;
  return capWait ?? (messageDecision.ok ? { action: "wait", reason: "nothing_queued", retryMinutes: retryMinutesFor("nothing_queued") } : waitFromDecision(messageDecision));
}

/** A page of your LinkedIn connections to read, when a started campaign needs more people and today's reads are not used up. */
async function nextRead(a: LinkedInAccount, live: string[], now: Date): Promise<WorkerNext | null> {
  const { data } = await db().from("linkedin_campaigns").select("id, audience").in("id", live).not("approved_at", "is", null);
  for (const c of (data ?? []) as Array<{ id: string; audience: Record<string, unknown> }>) {
    if (!isNetworkAudience(c.audience)) continue;
    const progress = readProgress(c.audience);
    const { count } = await db().from("linkedin_targets").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("route", "message").eq("status", "queued");
    if (!canReadNow({ progress, queued: count ?? 0, now, timeZone: a.timezone }).ok) continue;
    return { action: "read", campaignId: c.id, page: progress.page, searchUrl: progress.searchUrl, filters: readNetworkFilters(c.audience) };
  }
  return null;
}

export type ReadReport = {
  campaignId: string; page: number; people: Array<{ slug: string; name: string | null; headline?: string | null }>; searchUrl?: string | null;
  /** False when the sender could not set the filters, so the page shows people outside them. Nothing is kept then. */
  filtersApplied: boolean; failed?: boolean; warning?: boolean; detail?: string | null; now?: Date;
};

/** The sender reports one page of connections. New people become targets that get a message. */
export async function recordRead(account: LinkedInAccount, input: ReadReport): Promise<{ added: number; paused: boolean }> {
  const now = input.now ?? new Date();
  const c = await db().from("linkedin_campaigns").select("id, account_id, audience").eq("id", input.campaignId).maybeSingle();
  const camp = c.data as { id: string; account_id: string; audience: Record<string, unknown> } | null;
  if (!camp || camp.account_id !== account.id || !isNetworkAudience(camp.audience)) return { added: 0, paused: false };
  const detail = (input.detail ?? "").slice(0, 300) || null;
  const base = { account_id: account.id, campaign_id: camp.id };
  const progress = readProgress(camp.audience);
  const save = (p: unknown) => db().from("linkedin_campaigns").update({ audience: { ...camp.audience, progress: p }, updated_at: now.toISOString() }).eq("id", camp.id);

  if (input.warning) {
    await db().from("linkedin_accounts").update({ status: "warning", paused_reason: detail ?? "LinkedIn showed a warning", updated_at: now.toISOString() }).eq("id", account.id);
    await event({ ...base, kind: "warning", detail });
    return { added: 0, paused: true };
  }
  if (input.failed || !input.filtersApplied) {
    await save(afterFailedRead(progress, now, account.timezone));
    await event({ ...base, kind: "failed", detail: detail ?? "Could not read your connections with these filters" });
    return { added: 0, paused: false };
  }

  const own = cleanSlug(account.linkedin_slug);
  const titles = readNetworkFilters(camp.audience).titles;
  // Titles are set but no headline could be read on this page: the page looks different, so keep nobody and try again later.
  if (titles && input.people.length > 0 && input.people.every((p) => !p.headline)) {
    await save(afterFailedRead(progress, now, account.timezone));
    await event({ ...base, kind: "failed", detail: "Could not read the headlines on this page, so titles could not be checked" });
    return { added: 0, paused: false };
  }
  const seen = new Map<string, string | null>();
  let skippedByTitle = 0;
  for (const p of input.people) {
    const slug = cleanSlug(p.slug);
    if (!slug || slug === own || seen.has(slug)) continue;
    if (!matchesTitles(p.headline, titles)) { skippedByTitle++; continue; }
    seen.set(slug, p.name?.trim().slice(0, 120) || null);
  }
  const slugs = [...seen.keys()];
  const skip = new Set<string>();
  if (slugs.length > 0) {
    const mine = await campaignIds(account.id);
    const { data } = await db().from("linkedin_targets").select("linkedin_slug, campaign_id, status").in("campaign_id", mine).in("linkedin_slug", slugs).neq("status", "skipped").neq("status", "failed");
    for (const r of (data ?? []) as Array<{ linkedin_slug: string }>) skip.add(r.linkedin_slug);
  }
  const fresh = slugs.filter((s) => !skip.has(s)).map((slug) => ({ campaign_id: camp.id, linkedin_slug: slug, display_name: seen.get(slug) ?? null, route: "message", status: "queued" }));
  if (fresh.length > 0) {
    const { error } = await db().from("linkedin_targets").insert(fresh);
    if (error) {
      await save(afterFailedRead(progress, now, account.timezone));
      await event({ ...base, kind: "failed", detail: "Could not save the people read" });
      return { added: 0, paused: false };
    }
  }
  await save(afterRead(progress, { page: input.page, added: fresh.length, seen: input.people.length, searchUrl: input.searchUrl, now, timeZone: account.timezone }));
  await event({ ...base, kind: "queued", detail: `Read page ${input.page} of your connections: ${fresh.length} new people${titles ? `, ${skippedByTitle} skipped by title` : ""}` });
  return { added: fresh.length, paused: false };
}

export type SenderOutcome = "sent" | "message_sent" | "dry_run" | "already_connected" | "not_connected" | "not_found" | "failed" | "warning";

/** The sender reports what happened. A warning of any kind stops everything on the account. */
export async function recordResult(account: LinkedInAccount, input: { targetId: string; outcome: SenderOutcome; detail?: string | null; now?: Date }): Promise<{ paused: boolean }> {
  const now = input.now ?? new Date();
  const t = await db().from("linkedin_targets").select("id, campaign_id, status, route").eq("id", input.targetId).maybeSingle();
  const target = t.data as { id: string; campaign_id: string; status: string; route?: string } | null;
  if (!target) return { paused: false };
  const camp = await db().from("linkedin_campaigns").select("id, account_id").eq("id", target.campaign_id).maybeSingle();
  if (!camp.data || camp.data.account_id !== account.id) return { paused: false }; // not this account's person
  const base = { account_id: account.id, campaign_id: target.campaign_id, target_id: target.id };
  const detail = (input.detail ?? "").slice(0, 300) || null;

  switch (input.outcome) {
    case "dry_run": {
      const hold = new Date(now.getTime() + DRY_RUN_HOLD_HOURS * 3_600_000).toISOString();
      await db().from("linkedin_targets").update({ next_action_at: hold, updated_at: now.toISOString() }).eq("id", target.id);
      const what = target.route === "message" ? "message was typed" : "invite was filled in";
      await event({ ...base, kind: "queued", detail: `Dry run: ${what}, not sent${detail ? ` (${detail})` : ""}` });
      return { paused: false };
    }
    case "sent": {
      await db().from("linkedin_targets").update({ status: "invited", invited_at: now.toISOString(), next_action_at: null, updated_at: now.toISOString() }).eq("id", target.id).eq("status", "queued");
      await db().from("linkedin_campaigns").update({ status: "running", updated_at: now.toISOString() }).eq("id", target.campaign_id).in("status", ["ready"]);
      await event({ ...base, kind: "invite_sent", detail });
      await pauseIfAcceptanceLow(target.campaign_id);
      return { paused: false };
    }
    case "message_sent": {
      await db().from("linkedin_targets").update({ status: "messaged", messaged_at: now.toISOString(), next_action_at: null, updated_at: now.toISOString() }).eq("id", target.id).eq("status", "queued");
      await event({ ...base, kind: "message_sent", detail });
      return { paused: false };
    }
    case "not_connected": {
      // The profile offers Connect, not Message: this person is not a connection. Back to the invite route.
      await db().from("linkedin_targets").update({ route: "invite", next_action_at: null, updated_at: now.toISOString() }).eq("id", target.id);
      await event({ ...base, kind: "queued", detail: "Not connected, moved back to invite" });
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
