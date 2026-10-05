/**
 * Invitation campaigns: saving, scheduling (which enrolls the audience) and
 * reading for the admin page.
 */
import "server-only";

import crypto from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { needsEmailReview } from "@/lib/marketing/recipient";
import { inviteToken, tokenHash, verifyInviteToken } from "@/lib/icfo-events/invitations/token";
import {
  INVITE_ROLES,
  OFFERS,
  normalizeStatSettings,
  type Audience,
  type CampaignStatus,
  type InviteRole,
  type StatSettings,
} from "@/lib/icfo-events/invitations/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export const DEFAULT_FROM_EMAIL = "outreach@icapos.com";

export type Campaign = {
  id: string;
  name: string;
  eventIds: string[];
  audiences: Audience[];
  status: CampaignStatus;
  scheduleAt: string | null;
  stats: StatSettings;
  fromName: string;
  fromEmail: string;
  createdAt: string;
};

export type CampaignSummary = Campaign & { invited: number; sent: number; opened: number; registered: number };

type Row = Record<string, unknown>;

function mapCampaign(r: Row): Campaign {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    eventIds: (r.event_ids as string[] | null) ?? [],
    audiences: cleanAudiences(r.audiences),
    status: (r.status as CampaignStatus) ?? "draft",
    scheduleAt: (r.schedule_at as string | null) ?? null,
    stats: normalizeStatSettings(r.stats_settings),
    fromName: String(r.from_name ?? "iCFO Capital"),
    fromEmail: String(r.from_email ?? DEFAULT_FROM_EMAIL),
    createdAt: String(r.created_at),
  };
}

/** Keep only known roles and offers. Pure. */
export function cleanAudiences(raw: unknown): Audience[] {
  if (!Array.isArray(raw)) return [];
  const out: Audience[] = [];
  for (const a of raw as Array<Record<string, unknown>>) {
    const role = a?.role as InviteRole;
    if (!INVITE_ROLES.includes(role) || out.some((x) => x.role === role)) continue;
    const allowed = OFFERS[role].map((o) => o.key);
    const offers = Array.isArray(a.offers) ? (a.offers as unknown[]).filter((o): o is string => typeof o === "string" && allowed.includes(o)) : allowed;
    out.push({
      role,
      listId: typeof a.listId === "string" && a.listId ? a.listId : null,
      offers,
      subject: typeof a.subject === "string" ? a.subject.slice(0, 200) : null,
      intro: typeof a.intro === "string" ? a.intro.slice(0, 1000) : null,
    });
  }
  return out;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data } = await db().from("event_invitation_campaigns").select("*").eq("id", id).maybeSingle();
  return data ? mapCampaign(data as Row) : null;
}

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const { data } = await db().from("event_invitation_campaigns").select("*").order("created_at", { ascending: false }).limit(200);
  const campaigns = ((data ?? []) as Row[]).map(mapCampaign);
  if (!campaigns.length) return [];
  const { data: inv } = await db()
    .from("event_invitations")
    .select("campaign_id, first_sent_at, opened_at, registered_event_ids")
    .in("campaign_id", campaigns.map((c) => c.id))
    .limit(50000);
  const agg = new Map<string, { invited: number; sent: number; opened: number; registered: number }>();
  for (const r of (inv ?? []) as Row[]) {
    const k = String(r.campaign_id);
    const a = agg.get(k) ?? { invited: 0, sent: 0, opened: 0, registered: 0 };
    a.invited += 1;
    if (r.first_sent_at) a.sent += 1;
    if (r.opened_at) a.opened += 1;
    if (Array.isArray(r.registered_event_ids) && r.registered_event_ids.length) a.registered += 1;
    agg.set(k, a);
  }
  return campaigns.map((c) => ({ ...c, ...(agg.get(c.id) ?? { invited: 0, sent: 0, opened: 0, registered: 0 }) }));
}

export type CampaignInput = {
  name: string;
  eventIds: string[];
  audiences: unknown;
  scheduleAt: string | null;
  stats: unknown;
  fromName?: string | null;
  fromEmail?: string | null;
};

/** Create or update. Events, audiences and timing only change while a draft or paused. */
export async function saveCampaign(id: string | null, input: CampaignInput, actorId: string): Promise<Campaign> {
  const row = {
    name: input.name.trim().slice(0, 160) || "Event invitations",
    event_ids: [...new Set(input.eventIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)))],
    audiences: cleanAudiences(input.audiences),
    schedule_at: input.scheduleAt || null,
    stats_settings: normalizeStatSettings(input.stats),
    from_name: (input.fromName ?? "").trim() || "iCFO Capital",
    from_email: (input.fromEmail ?? "").trim() || DEFAULT_FROM_EMAIL,
    updated_at: new Date().toISOString(),
  };
  if (!id) {
    const { data, error } = await db().from("event_invitation_campaigns").insert({ ...row, created_by: actorId }).select("*").single();
    if (error) throw new Error(error.message);
    return mapCampaign(data as Row);
  }
  const existing = await getCampaign(id);
  if (!existing) throw new Error("Campaign not found.");
  // A campaign that is sending keeps its events and audiences; only the live
  // number settings can still change.
  const locked = existing.status === "scheduled" || existing.status === "sending" || existing.status === "done";
  const patch = locked ? { stats_settings: row.stats_settings, updated_at: row.updated_at } : row;
  const { data, error } = await db().from("event_invitation_campaigns").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return mapCampaign(data as Row);
}

export async function deleteDraft(id: string): Promise<void> {
  const c = await getCampaign(id);
  if (!c) return;
  if (c.status !== "draft") throw new Error("Only a draft can be deleted. Pause it instead.");
  await db().from("event_invitation_campaigns").delete().eq("id", id);
}

type Member = { id: string; email: string; first_name: string | null; company: string | null; crm_contact_id: string | null; tags: string[] | null };

async function listMembers(listId: string): Promise<Member[]> {
  const out: Member[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await db()
      .from("marketing_list_contacts")
      .select("contact:marketing_contacts(id, email, first_name, company, crm_contact_id, tags)")
      .eq("list_id", listId)
      .range(from, from + 999);
    const rows = ((data ?? []) as Array<{ contact: Member | null }>).map((r) => r.contact).filter((c): c is Member => Boolean(c?.email));
    out.push(...rows);
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function unsubscribedSet(emails: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  for (let i = 0; i < emails.length; i += 500) {
    const { data } = await db().from("marketing_unsubscribes").select("email").in("email", emails.slice(i, i + 500));
    for (const r of (data ?? []) as Array<{ email: string }>) set.add(r.email.trim().toLowerCase());
  }
  return set;
}

/** Recipient counts per audience list, for the builder. */
export async function audienceCount(listId: string): Promise<number> {
  const { count } = await db().from("marketing_list_contacts").select("contact_id", { count: "exact", head: true }).eq("list_id", listId);
  return count ?? 0;
}

/**
 * Schedule: enroll everyone on the audience lists, then hand the campaign to the
 * runner. A person on more than one list is invited once, in the first role
 * listed (founder, then investor, then advisor). Unsubscribed addresses and
 * addresses flagged for review are left out.
 */
export async function scheduleCampaign(id: string, actorId: string): Promise<{ enrolled: number; skipped: number }> {
  const c = await getCampaign(id);
  if (!c) throw new Error("Campaign not found.");
  if (c.status !== "draft" && c.status !== "paused") throw new Error("This campaign is already scheduled.");
  if (!c.eventIds.length) throw new Error("Choose at least one event.");
  const audiences = c.audiences.filter((a) => a.listId);
  if (!audiences.length) throw new Error("Choose a list for at least one audience.");

  const seen = new Set<string>();
  const rows: Row[] = [];
  let skipped = 0;
  for (const role of INVITE_ROLES) {
    const a = audiences.find((x) => x.role === role);
    if (!a?.listId) continue;
    const members = await listMembers(a.listId);
    const unsub = await unsubscribedSet(members.map((m) => m.email.trim().toLowerCase()));
    for (const m of members) {
      const email = m.email.trim().toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      if (unsub.has(email) || needsEmailReview(m.tags)) { skipped += 1; continue; }
      const invId = crypto.randomUUID();
      rows.push({
        id: invId, campaign_id: id, role, email,
        first_name: m.first_name, company: m.company,
        marketing_contact_id: m.id, crm_contact_id: m.crm_contact_id,
        token_hash: tokenHash(inviteToken(invId)),
      });
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("event_invitations").upsert(rows.slice(i, i + 500), { onConflict: "campaign_id,email", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  await db().from("event_invitation_campaigns").update({
    status: "scheduled",
    schedule_at: c.scheduleAt ?? new Date().toISOString(),
    scheduled_by: actorId,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  return { enrolled: rows.length, skipped };
}

export async function setCampaignStatus(id: string, status: "paused" | "scheduled"): Promise<void> {
  const c = await getCampaign(id);
  if (!c) throw new Error("Campaign not found.");
  if (status === "paused" && !["scheduled", "sending"].includes(c.status)) throw new Error("Only a scheduled campaign can be paused.");
  if (status === "scheduled" && c.status !== "paused") throw new Error("Only a paused campaign can be resumed.");
  await db().from("event_invitation_campaigns").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
}

export type InvitationRecord = {
  id: string;
  campaignId: string;
  role: InviteRole;
  email: string;
  firstName: string | null;
  company: string | null;
  campaign: Campaign;
};

/** Resolve a token from a link. Null when invalid or the campaign is gone. */
export async function invitationFromToken(token: string | null | undefined): Promise<InvitationRecord | null> {
  const id = verifyInviteToken(token);
  if (!id) return null;
  const { data } = await db().from("event_invitations").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const campaign = await getCampaign(String(data.campaign_id));
  if (!campaign) return null;
  return {
    id: String(data.id),
    campaignId: campaign.id,
    role: data.role as InviteRole,
    email: String(data.email),
    firstName: (data.first_name as string | null) ?? null,
    company: (data.company as string | null) ?? null,
    campaign,
  };
}

export async function markOpened(invitationId: string): Promise<void> {
  await db().from("event_invitations").update({ opened_at: new Date().toISOString() }).eq("id", invitationId).is("opened_at", null);
}
