/**
 * The send log behind a job's Sent tab (Admin, System, Scheduled jobs): one row
 * per email or in-app message delivered while a scheduled job was running.
 * Best effort: a logging failure never affects the send itself.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { currentJob } from "@/lib/cron/job-context";

export const DELIVERY_RETENTION_DAYS = 30;
/** Stored email bodies are capped so one large message can't bloat the log. */
const MAX_HTML = 100_000;

export type DeliveryRecord = {
  channel: "email" | "in_app";
  recipientUserId?: string | null;
  toEmail?: string | null;
  subject: string;
  bodyHtml?: string | null;
  message?: string | null;
  status: "sent" | "failed" | "skipped";
  error?: string | null;
};

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function recordDelivery(d: DeliveryRecord): Promise<void> {
  const ctx = currentJob();
  if (!ctx) return;
  try {
    const client = db();
    await client.from("job_deliveries").insert({
      job: ctx.job,
      run_id: ctx.runId,
      channel: d.channel,
      recipient_user_id: d.recipientUserId ?? null,
      to_email: d.toEmail ?? null,
      subject: d.subject.slice(0, 500),
      body_html: d.bodyHtml ? d.bodyHtml.slice(0, MAX_HTML) : null,
      message: d.message ? d.message.slice(0, 2000) : null,
      status: d.status,
      error: d.error ? d.error.slice(0, 300) : null,
    });
    // Keep the log to the retention window; cheap with the (job, created_at) index.
    if (Math.random() < 0.05) {
      await client
        .from("job_deliveries")
        .delete()
        .lt("created_at", new Date(Date.now() - DELIVERY_RETENTION_DAYS * 86_400_000).toISOString());
    }
  } catch {
    /* log only */
  }
}

// ---- Reading the log (Scheduled jobs, a job's Sent tab) ----

export type DeliveryListItem = {
  id: number;
  channel: "email" | "in_app";
  recipientName: string | null;
  toEmail: string | null;
  subject: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  createdAt: string;
};

export type DeliveryDetail = DeliveryListItem & { job: string; bodyHtml: string | null; message: string | null };

type Row = {
  id: number; job: string; channel: "email" | "in_app"; recipient_user_id: string | null; to_email: string | null;
  subject: string; body_html?: string | null; message?: string | null; status: "sent" | "failed" | "skipped";
  error: string | null; created_at: string;
};

async function namesFor(client: SupabaseClient, rows: Row[]): Promise<{ byId: Map<string, string>; byEmail: Map<string, string> }> {
  const ids = [...new Set(rows.map((r) => r.recipient_user_id).filter((x): x is string => Boolean(x)))];
  const emails = [...new Set(rows.map((r) => r.to_email?.split(",")[0]?.trim().toLowerCase()).filter((x): x is string => Boolean(x)))];
  const byId = new Map<string, string>();
  const byEmail = new Map<string, string>();
  const [a, b] = await Promise.all([
    ids.length ? client.from("profiles").select("id, full_name, email").in("id", ids) : Promise.resolve({ data: [] }),
    emails.length ? client.from("profiles").select("id, full_name, email").in("email", emails) : Promise.resolve({ data: [] }),
  ]);
  for (const p of [...((a.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>), ...((b.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>)]) {
    const name = p.full_name ?? p.email ?? null;
    if (name) byId.set(p.id, name);
    if (name && p.email) byEmail.set(p.email.toLowerCase(), name);
  }
  return { byId, byEmail };
}

function toItem(r: Row, names: { byId: Map<string, string>; byEmail: Map<string, string> }): DeliveryListItem {
  const first = r.to_email?.split(",")[0]?.trim().toLowerCase() ?? "";
  return {
    id: r.id,
    channel: r.channel,
    recipientName: (r.recipient_user_id ? names.byId.get(r.recipient_user_id) : null) ?? names.byEmail.get(first) ?? null,
    toEmail: r.to_email,
    subject: r.subject,
    status: r.status,
    error: r.error,
    createdAt: r.created_at,
  };
}

/** What a job sent in the last 30 days, newest first. Empty when the log table isn't there. */
export async function listJobDeliveries(job: string, limit = 200): Promise<DeliveryListItem[]> {
  try {
    const client = db();
    const { data, error } = await client
      .from("job_deliveries")
      .select("id, job, channel, recipient_user_id, to_email, subject, status, error, created_at")
      .eq("job", job)
      .gte("created_at", new Date(Date.now() - DELIVERY_RETENTION_DAYS * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    const rows = data as Row[];
    const names = await namesFor(client, rows);
    return rows.map((r) => toItem(r, names));
  } catch {
    return [];
  }
}

export async function getJobDelivery(id: number): Promise<DeliveryDetail | null> {
  try {
    const client = db();
    const { data } = await client.from("job_deliveries").select("*").eq("id", id).maybeSingle();
    const r = data as Row | null;
    if (!r) return null;
    const names = await namesFor(client, [r]);
    return { ...toItem(r, names), job: r.job, bodyHtml: r.body_html ?? null, message: r.message ?? null };
  } catch {
    return null;
  }
}
