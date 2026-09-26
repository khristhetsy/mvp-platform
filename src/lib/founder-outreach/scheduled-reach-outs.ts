import "server-only";

/**
 * Reach out emails scheduled for later (Admin, company workspace, Reach out to
 * founder, Schedule). Stored in scheduled_reach_outs, sent by
 * /api/cron/scheduled-reach-outs every 5 minutes, or at once with Send now.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { deliverReachOut, type ReachOutVia } from "@/lib/founder-outreach/deliver-reach-out";
import { usZoneForState, type UsZone } from "@/lib/founder-outreach/us-time-zone";

export type ScheduledReachOutRow = {
  id: string;
  company_id: string;
  founder_id: string;
  created_by: string;
  to_email: string;
  subject: string;
  body: string;
  html: string;
  via: ReachOutVia;
  reply_to: string | null;
  also_nudge: boolean;
  send_at: string;
  status: "scheduled" | "sending" | "sent" | "canceled" | "failed";
  error: string | null;
};

/** Earliest and latest times a send can be scheduled for. */
export const MIN_LEAD_MS = 60_000;
export const MAX_LEAD_MS = 366 * 86_400_000;

export function validSendAt(sendAtIso: string, now: Date = new Date()): string | null {
  const t = new Date(sendAtIso).getTime();
  if (Number.isNaN(t)) return "Pick a date and time first.";
  if (t < now.getTime() + MIN_LEAD_MS) return "Pick a time in the future.";
  if (t > now.getTime() + MAX_LEAD_MS) return "Pick a time within the next year.";
  return null;
}

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function listScheduledReachOuts(companyId: string) {
  const { data } = await db()
    .from("scheduled_reach_outs")
    .select("id, to_email, subject, via, send_at, status, error, created_by")
    .eq("company_id", companyId)
    .in("status", ["scheduled", "sending", "failed"])
    .order("send_at", { ascending: true });
  return (data ?? []) as Array<Pick<ScheduledReachOutRow, "id" | "to_email" | "subject" | "via" | "send_at" | "status" | "error" | "created_by">>;
}

/** companyId null: any company (Scheduled jobs page). */
export async function cancelScheduledReachOut(companyId: string | null, id: string): Promise<boolean> {
  let q = db()
    .from("scheduled_reach_outs")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["scheduled", "failed"]);
  if (companyId) q = q.eq("company_id", companyId);
  const { data } = await q.select("id");
  return Boolean(data && data.length);
}

/** Claims one row (scheduled or failed → sending) so two runs never send it twice. */
async function claim(admin: SupabaseClient, id: string): Promise<ScheduledReachOutRow | null> {
  const { data } = await admin
    .from("scheduled_reach_outs")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["scheduled", "failed"])
    .select("*");
  return ((data ?? [])[0] as ScheduledReachOutRow | undefined) ?? null;
}

async function sendClaimed(admin: SupabaseClient, row: ScheduledReachOutRow): Promise<boolean> {
  const r = await deliverReachOut(
    admin,
    {
      companyId: row.company_id,
      founderId: row.founder_id,
      actorId: row.created_by,
      actorEmail: row.reply_to,
      to: row.to_email,
      subject: row.subject,
      body: row.body,
      html: row.html,
      via: row.via,
      alsoNudge: row.also_nudge,
    },
    { scheduled: true, scheduled_reach_out_id: row.id },
  );
  const now = new Date().toISOString();
  await admin
    .from("scheduled_reach_outs")
    .update(
      r.ok
        ? { status: "sent", sent_at: now, channel: r.channel ?? row.via, error: null, updated_at: now }
        : { status: "failed", error: r.error, updated_at: now },
    )
    .eq("id", row.id);
  return r.ok;
}

/** Send now (or send again after a failure). companyId null: any company. */
export async function sendScheduledReachOutNow(companyId: string | null, id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = db();
  if (companyId) {
    const { data: own } = await admin.from("scheduled_reach_outs").select("company_id").eq("id", id).maybeSingle();
    if ((own as { company_id?: string } | null)?.company_id !== companyId) return { ok: false, error: "This email has already been sent or canceled." };
  }
  const row = await claim(admin, id);
  if (!row) return { ok: false, error: "This email has already been sent or canceled." };
  const ok = await sendClaimed(admin, row);
  if (ok) return { ok: true };
  const { data } = await admin.from("scheduled_reach_outs").select("error").eq("id", id).maybeSingle();
  return { ok: false, error: (data as { error?: string } | null)?.error ?? "Could not send." };
}

/** The 5 minute job: sends every scheduled email whose time has come. */
export async function runDueScheduledReachOuts(limit = 50): Promise<{ due: number; sent: number; failed: number }> {
  const admin = db();
  const { data } = await admin
    .from("scheduled_reach_outs")
    .select("id")
    .eq("status", "scheduled")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(limit);
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    const row = await claim(admin, id);
    if (!row || row.status !== "sending") continue;
    if (await sendClaimed(admin, row)) sent += 1;
    else failed += 1;
  }
  return { due: ids.length, sent, failed };
}

// ---- Scheduled jobs page: every company's emails, and one email in full ----

export type ReachOutTab = "scheduled" | "sent" | "failed" | "canceled";
export const REACH_OUT_TABS: ReachOutTab[] = ["scheduled", "sent", "failed", "canceled"];
/** Sent and Canceled show the last 30 days. */
export const HISTORY_DAYS = 30;

export type ReachOutListItem = {
  id: string;
  companyId: string;
  companyName: string;
  founderName: string;
  subject: string;
  via: ReachOutVia;
  senderName: string;
  sendAt: string;
  sentAt: string | null;
  status: ScheduledReachOutRow["status"];
  error: string | null;
  zone: UsZone | null;
};

function statusesFor(tab: ReachOutTab): ScheduledReachOutRow["status"][] {
  return tab === "scheduled" ? ["scheduled", "sending"] : [tab];
}

type NameMaps = { companies: Map<string, { name: string; zone: UsZone | null }>; people: Map<string, string> };

async function names(admin: SupabaseClient, companyIds: string[], peopleIds: string[]): Promise<NameMaps> {
  const [{ data: cos }, { data: ppl }] = await Promise.all([
    companyIds.length ? admin.from("companies").select("id, company_name, state, country").in("id", companyIds) : Promise.resolve({ data: [] }),
    peopleIds.length ? admin.from("profiles").select("id, full_name, email").in("id", peopleIds) : Promise.resolve({ data: [] }),
  ]);
  const companies = new Map<string, { name: string; zone: UsZone | null }>();
  for (const c of (cos ?? []) as Array<{ id: string; company_name: string | null; state: string | null; country: string | null }>) {
    const z = usZoneForState(c.state, c.country);
    companies.set(c.id, { name: c.company_name ?? "Untitled", zone: z ? { abbr: z.abbr, iana: z.iana } : null });
  }
  const people = new Map<string, string>();
  for (const p of (ppl ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
    people.set(p.id, p.full_name ?? p.email ?? "Unknown");
  }
  return { companies, people };
}

export async function listReachOutsForJobsPage(tab: ReachOutTab, now: Date = new Date()): Promise<{
  items: ReachOutListItem[];
  counts: Record<ReachOutTab, number>;
}> {
  const admin = db();
  const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString();
  const countFor = async (t: ReachOutTab) => {
    let q = admin.from("scheduled_reach_outs").select("id", { count: "exact", head: true }).in("status", statusesFor(t));
    if (t === "sent" || t === "canceled") q = q.gte("updated_at", since);
    const { count } = await q;
    return count ?? 0;
  };
  let listQ = admin
    .from("scheduled_reach_outs")
    .select("id, company_id, founder_id, created_by, subject, via, send_at, sent_at, status, error, updated_at")
    .in("status", statusesFor(tab))
    .order("send_at", { ascending: tab === "scheduled" })
    .limit(200);
  if (tab === "sent" || tab === "canceled") listQ = listQ.gte("updated_at", since);
  const [{ data }, c1, c2, c3, c4] = await Promise.all([listQ, countFor("scheduled"), countFor("sent"), countFor("failed"), countFor("canceled")]);
  const rows = (data ?? []) as Array<Pick<ScheduledReachOutRow, "id" | "company_id" | "founder_id" | "created_by" | "subject" | "via" | "send_at" | "status" | "error"> & { sent_at: string | null }>;
  const maps = await names(
    admin,
    [...new Set(rows.map((r) => r.company_id))],
    [...new Set(rows.flatMap((r) => [r.founder_id, r.created_by]))],
  );
  const items = rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    companyName: maps.companies.get(r.company_id)?.name ?? "Untitled",
    founderName: maps.people.get(r.founder_id) ?? "the founder",
    subject: r.subject,
    via: r.via,
    senderName: maps.people.get(r.created_by) ?? "Staff",
    sendAt: r.send_at,
    sentAt: r.sent_at,
    status: r.status,
    error: r.error,
    zone: maps.companies.get(r.company_id)?.zone ?? null,
  }));
  return { items, counts: { scheduled: c1, sent: c2, failed: c3, canceled: c4 } };
}

export type ReachOutDetail = ReachOutListItem & {
  toEmail: string;
  replyTo: string | null;
  html: string;
  alsoNudge: boolean;
  createdAt: string;
};

/** One email in full, as it will be (or was) sent. companyId limits it to one company. */
export async function getScheduledReachOut(id: string, companyId: string | null = null): Promise<ReachOutDetail | null> {
  const admin = db();
  let q = admin.from("scheduled_reach_outs").select("*").eq("id", id);
  if (companyId) q = q.eq("company_id", companyId);
  const { data } = await q.maybeSingle();
  const r = data as (ScheduledReachOutRow & { sent_at: string | null; created_at: string }) | null;
  if (!r) return null;
  const maps = await names(admin, [r.company_id], [r.founder_id, r.created_by]);
  return {
    id: r.id,
    companyId: r.company_id,
    companyName: maps.companies.get(r.company_id)?.name ?? "Untitled",
    founderName: maps.people.get(r.founder_id) ?? "the founder",
    subject: r.subject,
    via: r.via,
    senderName: maps.people.get(r.created_by) ?? "Staff",
    sendAt: r.send_at,
    sentAt: r.sent_at,
    status: r.status,
    error: r.error,
    zone: maps.companies.get(r.company_id)?.zone ?? null,
    toEmail: r.to_email,
    replyTo: r.reply_to,
    html: r.html,
    alsoNudge: r.also_nudge,
    createdAt: r.created_at,
  };
}
