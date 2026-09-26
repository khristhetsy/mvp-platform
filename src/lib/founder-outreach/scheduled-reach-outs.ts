import "server-only";

/**
 * Reach out emails scheduled for later (Admin, company workspace, Reach out to
 * founder, Schedule). Stored in scheduled_reach_outs, sent by
 * /api/cron/scheduled-reach-outs every 5 minutes, or at once with Send now.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { deliverReachOut, type ReachOutVia } from "@/lib/founder-outreach/deliver-reach-out";

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

export async function cancelScheduledReachOut(companyId: string, id: string): Promise<boolean> {
  const { data } = await db()
    .from("scheduled_reach_outs")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)
    .in("status", ["scheduled", "failed"])
    .select("id");
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

/** Send now from the company page. */
export async function sendScheduledReachOutNow(companyId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = db();
  const row = await claim(admin, id);
  if (!row || row.company_id !== companyId) return { ok: false, error: "This email has already been sent or canceled." };
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
