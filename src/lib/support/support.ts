// Founder support: per-company request threads staff triage from a queue. The
// support_* tables aren't in the generated types yet, so queries run untyped as
// elsewhere. RLS enforces founder-owns / staff-manages; callers pass the right
// client (cookie-scoped for founder/staff reads, service-role for cross-cutting
// staff aggregation).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const SUPPORT_STATUSES = ["open", "pending_founder", "resolved"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_SOURCES = ["request_help", "question", "manual"] as const;
export type SupportSource = (typeof SUPPORT_SOURCES)[number];

export type SupportRequest = {
  id: string;
  company_id: string;
  founder_id: string;
  subject: string;
  context_stage: string | null;
  context_item: string | null;
  source: string;
  status: SupportStatus;
  assigned_to: string | null;
  priority: string;
  csat: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type SupportMessage = {
  id: string;
  request_id: string;
  author_user_id: string;
  author_role: "founder" | "staff";
  body: string;
  created_at: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function db(c: SupabaseClient<Database>): SupabaseClient<any> {
  return c as unknown as SupabaseClient<any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const REQUEST_COLS =
  "id, company_id, founder_id, subject, context_stage, context_item, source, status, assigned_to, priority, csat, created_at, updated_at, resolved_at";

export type CreateSupportRequestInput = {
  companyId: string;
  founderId: string;
  subject: string;
  body: string;
  source?: SupportSource;
  contextStage?: string | null;
  contextItem?: string | null;
};

export async function createSupportRequest(
  supabase: SupabaseClient<Database>,
  input: CreateSupportRequestInput,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await db(supabase)
    .from("support_requests")
    .insert({
      company_id: input.companyId,
      founder_id: input.founderId,
      subject: input.subject.trim().slice(0, 160),
      source: input.source ?? "request_help",
      context_stage: input.contextStage ?? null,
      context_item: input.contextItem ?? null,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create the request." };
  const id = (data as { id: string }).id;

  if (input.body.trim()) {
    await db(supabase).from("support_messages").insert({
      request_id: id,
      author_user_id: input.founderId,
      author_role: "founder",
      body: input.body.trim().slice(0, 4000),
    });
  }
  return { id };
}

export async function listFounderRequests(
  supabase: SupabaseClient<Database>,
  founderId: string,
): Promise<SupportRequest[]> {
  const { data } = await db(supabase)
    .from("support_requests")
    .select(REQUEST_COLS)
    .eq("founder_id", founderId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as SupportRequest[];
}

/** Staff triage queue: open + waiting requests, newest first. */
export async function listSupportQueue(
  supabase: SupabaseClient<Database>,
  opts?: { includeResolved?: boolean },
): Promise<SupportRequest[]> {
  let q = db(supabase).from("support_requests").select(REQUEST_COLS);
  if (!opts?.includeResolved) q = q.in("status", ["open", "pending_founder"]);
  const { data } = await q.order("created_at", { ascending: false }).limit(300);
  return (data ?? []) as SupportRequest[];
}

export async function getSupportThread(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<{ request: SupportRequest; messages: SupportMessage[] } | null> {
  const { data: reqRow } = await db(supabase).from("support_requests").select(REQUEST_COLS).eq("id", requestId).maybeSingle();
  const request = reqRow as SupportRequest | null;
  if (!request) return null;
  const { data: msgs } = await db(supabase)
    .from("support_messages")
    .select("id, request_id, author_user_id, author_role, body, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true })
    .limit(500);
  return { request, messages: (msgs ?? []) as SupportMessage[] };
}

export async function addSupportMessage(
  supabase: SupabaseClient<Database>,
  input: { requestId: string; authorUserId: string; authorRole: "founder" | "staff"; body: string },
): Promise<{ ok: true } | { error: string }> {
  const { error } = await db(supabase).from("support_messages").insert({
    request_id: input.requestId,
    author_user_id: input.authorUserId,
    author_role: input.authorRole,
    body: input.body.trim().slice(0, 4000),
  });
  if (error) return { error: error.message };
  // Staff reply moves the ball to the founder; founder reply reopens.
  await db(supabase)
    .from("support_requests")
    .update({ status: input.authorRole === "staff" ? "pending_founder" : "open", updated_at: new Date().toISOString() })
    .eq("id", input.requestId);
  return { ok: true };
}

export async function assignSupportRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
  assigneeId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await db(supabase)
    .from("support_requests")
    .update({ assigned_to: assigneeId, updated_at: new Date().toISOString() })
    .eq("id", requestId);
  return error ? { error: error.message } : { ok: true };
}

export async function resolveSupportRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await db(supabase)
    .from("support_requests")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", requestId);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Auto-assign a new request to the least-loaded eligible staff member
 * (round-robin by open assignment count) — the default rule. Pass a service-role
 * client. Returns the chosen assignee id, or null when no staff are available.
 * The rule is intentionally simple and lives here so a settings-driven chooser
 * (pool / round-robin / company owner) can wrap it later.
 */
export async function autoAssignSupportRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<string | null> {
  const { data: staff } = await db(supabase).from("profiles").select("id").in("role", ["admin", "analyst"]).limit(50);
  const ids = ((staff ?? []) as { id: string }[]).map((s) => s.id);
  if (ids.length === 0) return null;

  const { data: openRows } = await db(supabase)
    .from("support_requests")
    .select("assigned_to")
    .in("status", ["open", "pending_founder"])
    .not("assigned_to", "is", null);
  const load = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const row of (openRows ?? []) as { assigned_to: string | null }[]) {
    if (row.assigned_to && load.has(row.assigned_to)) load.set(row.assigned_to, (load.get(row.assigned_to) ?? 0) + 1);
  }
  // Lowest open load wins (ties break by first — good enough for round-robin).
  const assignee = ids.reduce((best, id) => ((load.get(id) ?? 0) < (load.get(best) ?? 0) ? id : best), ids[0]);

  const { error } = await db(supabase)
    .from("support_requests")
    .update({ assigned_to: assignee, updated_at: new Date().toISOString() })
    .eq("id", requestId);
  return error ? null : assignee;
}

/** Founder rates a resolved request: 1 (thumbs up) or -1 (thumbs down). RLS
 *  restricts this to the founder's own rows. */
export async function setSupportCsat(
  supabase: SupabaseClient<Database>,
  requestId: string,
  csat: 1 | -1,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await db(supabase)
    .from("support_requests")
    .update({ csat, updated_at: new Date().toISOString() })
    .eq("id", requestId);
  return error ? { error: error.message } : { ok: true };
}
