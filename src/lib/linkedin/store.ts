// Database access for LinkedIn outreach (admin only, service role). The tables are new and
// not in the generated Supabase types yet, so this uses the loose client, like sales/tasks.ts.
// Step 1 never sends to LinkedIn: starting a campaign queues targets and makes hand tasks.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createTask } from "@/lib/sales/tasks";
import { logCommunication, type LogResult } from "@/lib/notes-log";
import { isNetworkAudience } from "./network";
import { classifyContact, summarize, type AudienceContact, type AudienceSummary, type Classified, type TargetRoute } from "./audience";
import { checkNetworkWording, checkWording, isApproved, wordingHash, type InviteVariant } from "./wording";
import { acceptanceTooLow, DEFAULT_MANUAL_ALLOWANCE, type SafetyLevel } from "./safety";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type LinkedInAccount = {
  id: string; owner_id: string; label: string; linkedin_slug: string | null;
  status: "not_connected" | "connected" | "paused" | "warning"; paused_reason: string | null;
  safety_level: SafetyLevel; custom_daily_cap: number | null; custom_weekly_cap: number | null;
  manual_allowance: number; high_value_tag: string | null; warm_up_started_at: string | null; timezone: string; sender_key_set: boolean; worker_last_seen_at: string | null;
  send_on_schedule: boolean; handoff_enabled: boolean; withdraw_pending: boolean; weekly_summary: boolean;
};

const ACCOUNT_COLS = "id, owner_id, label, linkedin_slug, status, paused_reason, safety_level, custom_daily_cap, custom_weekly_cap, manual_allowance, high_value_tag, warm_up_started_at, timezone, sender_key_set, worker_last_seen_at, send_on_schedule, handoff_enabled, withdraw_pending, weekly_summary";

/** The one pilot account for this admin. Created on first visit, not connected until Step 2. */
export async function getOrCreateAccount(ownerId: string, label: string): Promise<LinkedInAccount> {
  const found = await db().from("linkedin_accounts").select(ACCOUNT_COLS).eq("owner_id", ownerId).maybeSingle();
  if (found.data) return found.data as LinkedInAccount;
  const ins = await db().from("linkedin_accounts").insert({ owner_id: ownerId, label, manual_allowance: DEFAULT_MANUAL_ALLOWANCE }).select(ACCOUNT_COLS).single();
  if (ins.error) {
    const again = await db().from("linkedin_accounts").select(ACCOUNT_COLS).eq("owner_id", ownerId).maybeSingle();
    if (again.data) return again.data as LinkedInAccount;
    throw new Error(ins.error.message);
  }
  return ins.data as LinkedInAccount;
}

export type AccountPatch = Partial<Pick<LinkedInAccount,
  "safety_level" | "custom_daily_cap" | "custom_weekly_cap" | "manual_allowance" | "high_value_tag" |
  "send_on_schedule" | "handoff_enabled" | "withdraw_pending" | "weekly_summary" | "timezone" | "status" | "paused_reason">>;

export async function updateAccount(id: string, patch: AccountPatch): Promise<LinkedInAccount> {
  const { data, error } = await db().from("linkedin_accounts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select(ACCOUNT_COLS).single();
  if (error) throw new Error(error.message);
  return data as LinkedInAccount;
}

export type CampaignRow = {
  id: string; account_id: string; name: string;
  status: "draft" | "pending_approval" | "ready" | "running" | "paused" | "completed" | "stopped";
  audience: Record<string, unknown>; invite_variants: InviteVariant[]; message_text: string | null;
  /** Wording for people already connected. Optional. */
  connected_message_text: string | null;
  wording_hash: string | null; approved_by: string | null; approved_at: string | null;
  handoff_mode: "web_chat" | "linkedin"; agent: "johnny" | "jessica"; created_at: string;
  /** Set when the campaign is archived. Null while it is active. */
  archived_at: string | null;
};

const CAMPAIGN_COLS = "id, account_id, name, status, audience, invite_variants, message_text, connected_message_text, wording_hash, approved_by, approved_at, handoff_mode, agent, created_at, archived_at";

export type CampaignWithStats = CampaignRow & { people: number; invited: number; accepted: number; messaged: number; needs_approval: boolean };

export async function listCampaigns(accountId: string): Promise<CampaignWithStats[]> {
  const { data } = await db().from("linkedin_campaigns").select(CAMPAIGN_COLS).eq("account_id", accountId).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as CampaignRow[];
  if (rows.length === 0) return [];
  const t = await db().from("linkedin_targets").select("campaign_id, status, route").in("campaign_id", rows.map((r) => r.id)).limit(20000);
  const counts = new Map<string, { people: number; invited: number; accepted: number; messaged: number }>();
  for (const x of (t.data ?? []) as Array<{ campaign_id: string; status: string; route?: string }>) {
    if (x.status === "skipped") continue;
    const c = counts.get(x.campaign_id) ?? { people: 0, invited: 0, accepted: 0, messaged: 0 };
    c.people += 1;
    if (x.route === "message") { if (["messaged", "replied", "handed_off"].includes(x.status)) c.messaged += 1; counts.set(x.campaign_id, c); continue; } // a message to an existing connection is not an invite
    if (["invited", "accepted", "messaged", "replied", "handed_off", "withdrawn"].includes(x.status)) c.invited += 1;
    if (["accepted", "messaged", "replied", "handed_off"].includes(x.status)) c.accepted += 1;
    counts.set(x.campaign_id, c);
  }
  return rows.map((r) => ({ ...r, ...(counts.get(r.id) ?? { people: 0, invited: 0, accepted: 0, messaged: 0 }), needs_approval: !isApproved(r) }));
}

export async function getCampaign(id: string): Promise<CampaignRow | null> {
  const { data } = await db().from("linkedin_campaigns").select(CAMPAIGN_COLS).eq("id", id).maybeSingle();
  return (data as CampaignRow) ?? null;
}

export type CampaignInput = {
  name: string; audience: Record<string, unknown>; invite_variants: InviteVariant[]; message_text: string | null;
  connected_message_text?: string | null;
  handoff_mode: "web_chat" | "linkedin"; agent: "johnny" | "jessica";
};

export async function createCampaign(accountId: string, createdBy: string, input: CampaignInput): Promise<CampaignRow> {
  const { data, error } = await db().from("linkedin_campaigns").insert({ ...input, account_id: accountId, created_by: createdBy, status: "draft" }).select(CAMPAIGN_COLS).single();
  if (error) throw new Error(error.message);
  return data as CampaignRow;
}

/** Edit a campaign. Any change to the wording clears the approval, and a running campaign pauses. */
export async function updateCampaign(id: string, patch: Partial<CampaignInput>): Promise<CampaignRow> {
  const current = await getCampaign(id);
  if (!current) throw new Error("Campaign not found.");
  const next = { ...current, ...patch };
  const wordingChanged = wordingHash(next.invite_variants, next.message_text, next.connected_message_text) !== wordingHash(current.invite_variants, current.message_text, current.connected_message_text);
  const update: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (wordingChanged) {
    update.approved_at = null; update.approved_by = null; update.wording_hash = null;
    if (current.status === "ready" || current.status === "running") update.status = "pending_approval";
  }
  const { data, error } = await db().from("linkedin_campaigns").update(update).eq("id", id).select(CAMPAIGN_COLS).single();
  if (error) throw new Error(error.message);
  return data as CampaignRow;
}

export type ApproveResult = { ok: true; campaign: CampaignRow } | { ok: false; problems: Array<{ field: string; message: string }> };

/** A person approves the exact wording. The approval stores a fingerprint of that text. */
export async function approveCampaign(id: string, approverId: string): Promise<ApproveResult> {
  const c = await getCampaign(id);
  if (!c) throw new Error("Campaign not found.");
  const problems = isNetworkAudience(c.audience) ? checkNetworkWording(c.connected_message_text) : checkWording(c.invite_variants, c.message_text, c.connected_message_text);
  if (problems.length) return { ok: false, problems };
  const { data, error } = await db().from("linkedin_campaigns").update({
    approved_by: approverId, approved_at: new Date().toISOString(), wording_hash: wordingHash(c.invite_variants, c.message_text, c.connected_message_text),
    status: c.status === "draft" || c.status === "pending_approval" ? "draft" : c.status, updated_at: new Date().toISOString(),
  }).eq("id", id).select(CAMPAIGN_COLS).single();
  if (error) throw new Error(error.message);
  await event({ campaign_id: id, account_id: c.account_id, kind: "approved", created_by: approverId });
  return { ok: true, campaign: data as CampaignRow };
}

// ------------------------------------------------------------------ audience

export type AudienceFilters = { module?: "investor" | "founder"; stage?: string; tag?: string; industry?: string; limit?: number };

const CONTACT_COLS = "id, name, email, linkedin_slug, source, tags, raw, module";
const AUDIENCE_MAX = 2000;

export function readFilters(audience: Record<string, unknown>): AudienceFilters {
  const f = (audience.filters ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof f[k] === "string" && (f[k] as string).trim() ? (f[k] as string).trim() : undefined);
  const mod = f.module === "investor" || f.module === "founder" ? f.module : undefined;
  return { module: mod, stage: s("stage"), tag: s("tag"), industry: s("industry") };
}

type ContactRow = AudienceContact & { module: string | null };

async function loadContacts(filters: AudienceFilters): Promise<ContactRow[]> {
  let q = db().from("crm_contacts").select(CONTACT_COLS).not("linkedin_slug", "is", null).limit(Math.min(filters.limit ?? AUDIENCE_MAX, AUDIENCE_MAX));
  if (filters.module) q = q.eq("module", filters.module);
  if (filters.stage) q = q.eq("stage", filters.stage);
  if (filters.tag) q = q.contains("tags", [filters.tag]);
  if (filters.industry) q = q.filter("profile->industries", "cs", JSON.stringify([filters.industry]));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContactRow[];
}

async function unsubscribedEmails(emails: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  for (let i = 0; i < clean.length; i += 500) {
    const { data } = await db().from("marketing_unsubscribes").select("email").in("email", clean.slice(i, i + 500));
    for (const r of (data ?? []) as Array<{ email: string }>) out.add(r.email.toLowerCase());
  }
  return out;
}

async function contactsInOtherOutreach(ids: string[], exceptCampaign: string | null): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    let q = db().from("linkedin_targets").select("contact_id, campaign_id, status, linkedin_campaigns!inner(status)")
      .in("contact_id", ids.slice(i, i + 500)).neq("status", "skipped").in("linkedin_campaigns.status", ["ready", "running", "paused"]);
    if (exceptCampaign) q = q.neq("campaign_id", exceptCampaign);
    const { data } = await q;
    for (const r of (data ?? []) as Array<{ contact_id: string | null }>) if (r.contact_id) out.add(r.contact_id);
  }
  return out;
}

export type AudiencePreview = { summary: AudienceSummary; sample: Array<{ id: string; name: string | null; route: TargetRoute | "skipped"; reason?: string }> };

async function classifyAudience(account: LinkedInAccount, campaignId: string | null, filters: AudienceFilters): Promise<{ contacts: ContactRow[]; rows: Classified[] }> {
  const contacts = await loadContacts(filters);
  const [unsub, busy] = await Promise.all([
    unsubscribedEmails(contacts.map((c) => c.email ?? "")),
    contactsInOtherOutreach(contacts.map((c) => c.id), campaignId),
  ]);
  const rows = contacts.map((c) => classifyContact(c, { unsubscribedEmails: unsub, inOtherOutreach: busy, highValueTag: account.high_value_tag, emailFirst: true }));
  return { contacts, rows };
}

/** How many people a campaign would reach, split by route. Reads only, writes nothing. */
export async function previewAudience(account: LinkedInAccount, campaignId: string | null, filters: AudienceFilters): Promise<AudiencePreview> {
  const { contacts, rows } = await classifyAudience(account, campaignId, filters);
  const byId = new Map(contacts.map((c) => [c.id, c] as const));
  return {
    summary: summarize(rows),
    sample: rows.slice(0, 8).map((r) => ({ id: r.contactId, name: byId.get(r.contactId)?.name ?? null, route: r.skip ? "skipped" : r.route, reason: r.skip })),
  };
}

// ------------------------------------------------------------------ start, pause, events

export async function event(e: { account_id?: string | null; campaign_id?: string | null; target_id?: string | null; kind: string; detail?: string | null; created_by?: string | null }): Promise<void> {
  const { error } = await db().from("linkedin_events").insert(e);
  if (error) console.error("[linkedin] event failed", { kind: e.kind, error: error.message });
}

export type StartResult = { ok: true; summary: AudienceSummary; tasks: number } | { ok: false; error: string };

/** Queue the campaign. Needs approved wording. Hand tasks are made now; invites wait for the sender (Step 2). */
export async function startCampaign(id: string, userId: string): Promise<StartResult> {
  const c = await getCampaign(id);
  if (!c) return { ok: false, error: "Campaign not found." };
  if (!["draft", "pending_approval", "paused"].includes(c.status)) return { ok: false, error: "This campaign is already started." };
  if (!isApproved(c)) return { ok: false, error: "Approve the wording before starting." };
  const accRes = await db().from("linkedin_accounts").select(ACCOUNT_COLS).eq("id", c.account_id).single();
  const account = accRes.data as LinkedInAccount | null;
  if (!account) return { ok: false, error: "Account not found." };

  if (isNetworkAudience(c.audience)) {
    // People are read from your own LinkedIn connections by the sender, a few pages a day. Nothing to queue now.
    await db().from("linkedin_campaigns").update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", id);
    await event({ account_id: account.id, campaign_id: id, kind: "started", detail: "Reading your LinkedIn connections", created_by: userId });
    return { ok: true, summary: summarize([]), tasks: 0 };
  }

  const { contacts, rows } = await classifyAudience(account, id, readFilters(c.audience));
  const byId = new Map(contacts.map((x) => [x.id, x] as const));
  const existing = await db().from("linkedin_targets").select("contact_id").eq("campaign_id", id).limit(20000);
  const have = new Set(((existing.data ?? []) as Array<{ contact_id: string | null }>).map((r) => r.contact_id));

  const fresh = rows.filter((r) => !have.has(r.contactId)).map((r) => ({
    campaign_id: id, contact_id: r.contactId, linkedin_slug: r.slug, display_name: byId.get(r.contactId)?.name ?? null,
    route: r.skip ? "invite" : r.route, status: r.skip ? "skipped" : "queued", skip_reason: r.skip ?? null,
  }));
  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await db().from("linkedin_targets").insert(fresh.slice(i, i + 500));
    if (error) return { ok: false, error: error.message };
  }

  let tasks = 0;
  const manual = await db().from("linkedin_targets").select("id, contact_id, linkedin_slug, display_name").eq("campaign_id", id).eq("route", "manual").eq("status", "queued").is("task_id", null).limit(500);
  for (const t of (manual.data ?? []) as Array<{ id: string; contact_id: string | null; linkedin_slug: string | null; display_name: string | null }>) {
    const task = await createTask({
      title: `Send LinkedIn invite to ${t.display_name ?? t.linkedin_slug ?? "contact"}`, taskType: "LinkedIn",
      summary: `Send this invite by hand: https://www.linkedin.com/in/${t.linkedin_slug}/ (campaign: ${c.name}). Approved wording is in the campaign.`,
      assigneeId: account.owner_id, contactCrmId: t.contact_id, contactName: t.display_name, createdBy: userId,
    }).catch(() => null);
    if (task) { await db().from("linkedin_targets").update({ task_id: task.id }).eq("id", t.id); tasks += 1; }
  }

  await db().from("linkedin_campaigns").update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", id);
  await event({ account_id: account.id, campaign_id: id, kind: "started", detail: `${fresh.length} people queued`, created_by: userId });
  return { ok: true, summary: summarize(rows), tasks };
}

export async function setCampaignStatus(id: string, status: "paused" | "ready" | "stopped", userId: string): Promise<void> {
  const c = await getCampaign(id);
  if (!c) throw new Error("Campaign not found.");
  await db().from("linkedin_campaigns").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  await event({ account_id: c.account_id, campaign_id: id, kind: status === "paused" ? "paused" : status === "stopped" ? "stopped" : "resumed", created_by: userId });
}

/** Only a campaign that is not working or waiting to send can be archived or deleted. Stop it first. */
export function canRemoveCampaign(status: CampaignRow["status"]): boolean {
  return status === "draft" || status === "pending_approval" || status === "stopped" || status === "completed";
}

export type RemoveResult = { ok: true } | { ok: false; error: string };

/** Archive keeps the campaign and its people. Restore brings it back to the list. */
export async function setCampaignArchived(id: string, archived: boolean): Promise<RemoveResult> {
  const c = await getCampaign(id);
  if (!c) return { ok: false, error: "Campaign not found." };
  if (archived && !canRemoveCampaign(c.status)) return { ok: false, error: "Stop the campaign before archiving it." };
  const now = new Date().toISOString();
  const { error } = await db().from("linkedin_campaigns").update({ archived_at: archived ? now : null, updated_at: now }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Delete removes the campaign, its people and its activity for good. Tasks already made stay. */
export async function deleteCampaign(id: string): Promise<RemoveResult> {
  const c = await getCampaign(id);
  if (!c) return { ok: false, error: "Campaign not found." };
  if (!canRemoveCampaign(c.status)) return { ok: false, error: "Stop the campaign before deleting it." };
  const { error } = await db().from("linkedin_campaigns").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Pause a running campaign when too few invites were accepted. Called by the sender (Step 2). */
export async function pauseIfAcceptanceLow(campaignId: string): Promise<boolean> {
  const { data } = await db().from("linkedin_targets").select("status, route").eq("campaign_id", campaignId).limit(20000);
  const rows = ((data ?? []) as Array<{ status: string; route?: string }>).filter((r) => r.route !== "message");
  const invited = rows.filter((r) => ["invited", "accepted", "messaged", "replied", "handed_off", "withdrawn"].includes(r.status)).length;
  const accepted = rows.filter((r) => ["accepted", "messaged", "replied", "handed_off"].includes(r.status)).length;
  if (!acceptanceTooLow({ invited, accepted })) return false;
  const c = await getCampaign(campaignId);
  if (!c) return false;
  await db().from("linkedin_campaigns").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", campaignId);
  await event({ account_id: c.account_id, campaign_id: campaignId, kind: "paused", detail: `Acceptance ${accepted} of ${invited} is below the floor` });
  return true;
}

// ------------------------------------------------------------------ inbox

export type ThreadRow = { id: string; contact_name: string; state: "ai_active" | "human" | "closed"; unread: boolean; last_message_at: string; last_preview: string | null; contact_id: string | null };
export type MessageRow = { id: string; direction: "in" | "out"; body: string; source: string; sent_at: string };

export async function listThreads(accountId: string): Promise<ThreadRow[]> {
  const { data } = await db().from("linkedin_threads").select("id, contact_name, state, unread, last_message_at, last_preview, contact_id").eq("account_id", accountId).order("last_message_at", { ascending: false }).limit(100);
  return (data ?? []) as ThreadRow[];
}

export async function listMessages(threadId: string): Promise<MessageRow[]> {
  const { data } = await db().from("linkedin_messages").select("id, direction, body, source, sent_at").eq("thread_id", threadId).order("sent_at", { ascending: true }).limit(200);
  return (data ?? []) as MessageRow[];
}

/** A person takes the conversation over from the AI assistant. */
export async function takeOverThread(threadId: string): Promise<void> {
  const { error } = await db().from("linkedin_threads").update({ state: "human", unread: false }).eq("id", threadId);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------ notes log

/** The Notes log line for one LinkedIn message. Pure. */
export function linkedInLogInput(a: { contactCrmId: string; direction: "outbound" | "inbound"; text: string; targetId: string; externalId: string; actorId?: string | null; occurredAt?: Date | null }) {
  return {
    kind: "message" as const,
    summary: a.direction === "outbound" ? "LinkedIn message sent" : "LinkedIn reply received",
    contactCrmId: a.contactCrmId, actorId: a.actorId ?? null, occurredAt: a.occurredAt ?? null,
    meta: { direction: a.direction, preview: a.text, subject: "LinkedIn", external_id: `linkedin:${a.externalId}`, href: `/admin/linkedin?target=${a.targetId}` },
  };
}

/** Log a LinkedIn message on the contact's Notes log. Never throws. Called by the sender and inbox readers. */
export function logLinkedInMessage(a: Parameters<typeof linkedInLogInput>[0]): Promise<LogResult> {
  return logCommunication(linkedInLogInput(a));
}

export type HubLinkedIn = { display_name: string; status: string; token_expires_at: string | null };

/** The Social Media Hub LinkedIn connection that matches this account's name. Read only, no tokens. */
export async function hubLinkedInFor(label: string): Promise<HubLinkedIn | null> {
  const { data } = await db().from("social_accounts").select("display_name, status, token_expires_at")
    .eq("platform", "linkedin").ilike("display_name", label.trim()).order("updated_at", { ascending: false }).limit(1);
  return ((data ?? [])[0] as HubLinkedIn | undefined) ?? null;
}
