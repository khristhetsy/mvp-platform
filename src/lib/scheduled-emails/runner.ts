import "server-only";

/**
 * Schedule send, the sending half. /api/cron/scheduled-emails (every 5
 * minutes) and Send now / Retry on Sales › Scheduled emails call in here.
 *
 * Each due row is claimed (scheduled or failed → sending) so two runs never
 * send it twice, then replayed through its send route as the person who
 * scheduled it: a one time server side session for that person is opened,
 * the route runs inside it, and the session is signed out again (that session
 * only; the person's own browser sessions are untouched).
 */
import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import { runAsActingUser } from "./acting-user";
import { SCHEDULED_HANDLERS } from "./handlers";
import type { ScheduledKind } from "./schedule";

export type ScheduledEmailRow = {
  id: string;
  created_by: string;
  kind: ScheduledKind;
  payload: Record<string, unknown>;
  params: Record<string, string>;
  to_label: string;
  subject: string;
  context_key: string | null;
  send_at: string;
  status: "scheduled" | "sending" | "sent" | "canceled" | "failed";
  attempts: number;
  sent_at: string | null;
  error: string | null;
};

/** A row stuck in sending this long (the run timed out) is marked failed, never resent on its own. */
const STUCK_MS = 15 * 60_000;
/** Stop starting new sends after this long so the run ends inside its 300 second limit. */
const RUN_BUDGET_MS = 200_000;

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** A signed in client for the person who scheduled the send, plus its sign out. */
async function signInAs(userId: string): Promise<{ client: SupabaseClient; done: () => Promise<void> }> {
  const admin = createServiceRoleClient();
  const { data: u, error: uErr } = await admin.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (uErr || !email) throw new Error("The person who scheduled this email no longer has an account.");
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) throw new Error("Couldn't sign in as the sender to send this email.");
  const { url, anonKey } = getSupabaseBrowserEnv();
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: v, error: vErr } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (vErr || !v?.session) throw new Error("Couldn't sign in as the sender to send this email.");
  return {
    client,
    done: async () => {
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    },
  };
}

async function notifyFailed(row: ScheduledEmailRow, error: string): Promise<void> {
  try {
    await db().from("notifications").insert({
      recipient_user_id: row.created_by,
      type: "scheduled_email_failed",
      title: "A scheduled email didn't send",
      message: `${row.subject || "(no subject)"} to ${row.to_label || "recipient"}: ${error}`.slice(0, 500),
      entity_type: "scheduled_emails",
      entity_id: row.id,
      deep_link: "/admin/sales/scheduled-emails",
    });
  } catch {
    // Best effort: the row itself shows Failed with the reason.
  }
}

async function claim(id: string): Promise<ScheduledEmailRow | null> {
  const { data: cur } = await db().from("scheduled_emails").select("attempts").eq("id", id).maybeSingle();
  const attempts = ((cur as { attempts?: number } | null)?.attempts ?? 0) + 1;
  const { data } = await db()
    .from("scheduled_emails")
    .update({ status: "sending", attempts, error: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["scheduled", "failed"])
    .select("*")
    .maybeSingle();
  return (data as ScheduledEmailRow | null) ?? null;
}

function messageFrom(body: unknown, status: number): string {
  const e = body && typeof body === "object" ? (body as { error?: unknown }).error : null;
  if (typeof e === "string" && e.trim()) return e.trim();
  return status === 401 || status === 403 ? "The sender no longer has permission to send this." : `Send failed (HTTP ${status}).`;
}

/** Sends one claimed row through its route. */
async function deliver(row: ScheduledEmailRow): Promise<{ ok: boolean; error?: string }> {
  const handler = SCHEDULED_HANDLERS[row.kind];
  let outcome: { ok: boolean; error?: string; result?: unknown; note?: string | null };
  try {
    if (!handler) throw new Error("Unknown kind of scheduled email.");
    const session = await signInAs(row.created_by);
    try {
      const req = new NextRequest(new URL(handler.path(row.params ?? {}), "http://scheduled-email.local"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row.payload ?? {}),
      });
      const res = await runAsActingUser({ userId: row.created_by, client: session.client }, () => handler.run(req, row.params ?? {}));
      const body = await res.json().catch(() => null);
      if (!res.ok) outcome = { ok: false, error: messageFrom(body, res.status) };
      else {
        // Contracts: the packet was created but the cover email didn't go out.
        const b = (body ?? {}) as { delivered?: boolean; deliveryError?: string };
        outcome = { ok: true, result: body, note: b.delivered === false ? `Sent, but the email didn't deliver: ${b.deliveryError ?? "unknown reason"}` : null };
      }
    } finally {
      await session.done();
    }
  } catch (err) {
    outcome = { ok: false, error: err instanceof Error ? err.message : "Send failed." };
  }

  const now = new Date().toISOString();
  await db()
    .from("scheduled_emails")
    .update(outcome.ok
      ? { status: "sent", sent_at: now, error: outcome.note ?? null, result: outcome.result ?? null, updated_at: now }
      : { status: "failed", error: outcome.error ?? "Send failed.", updated_at: now })
    .eq("id", row.id);
  if (!outcome.ok) await notifyFailed(row, outcome.error ?? "Send failed.");
  else if (outcome.note) await notifyFailed(row, outcome.note);
  return { ok: outcome.ok, error: outcome.error };
}

/** Send now / Retry: claims and sends one row at once. */
export async function sendScheduledEmailNow(id: string): Promise<{ ok: boolean; error?: string }> {
  const row = await claim(id);
  if (!row) return { ok: false, error: "This email is already sending, sent or canceled." };
  return deliver(row);
}

export async function runDueScheduledEmails(): Promise<{ due: number; sent: number; failed: number; stuck: number }> {
  const started = Date.now();
  const nowIso = new Date().toISOString();

  const { data: stuckRows } = await db()
    .from("scheduled_emails")
    .update({ status: "failed", error: "The send timed out before it finished. Check the recipient's inbox or your Sent folder before retrying.", updated_at: nowIso })
    .eq("status", "sending")
    .lt("updated_at", new Date(Date.now() - STUCK_MS).toISOString())
    .select("*");
  for (const r of (stuckRows ?? []) as ScheduledEmailRow[]) await notifyFailed(r, r.error ?? "Timed out.");

  const { data } = await db()
    .from("scheduled_emails")
    .select("id")
    .eq("status", "scheduled")
    .lte("send_at", nowIso)
    .order("send_at", { ascending: true })
    .limit(25);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    const row = await claim(id);
    if (!row) continue;
    const r = await deliver(row);
    if (r.ok) sent += 1;
    else failed += 1;
  }
  return { due: ids.length, sent, failed, stuck: (stuckRows ?? []).length };
}
