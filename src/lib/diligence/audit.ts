// Append-only audit writer for the DD module (dd_audit_log). Service role only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type DdAuditEntry = { id: number; action: string; target: string | null; actor: string | null; at: string };

/** Engagement audit chain (newest first), with actor emails resolved. */
export async function listDdAudit(supabase: SupabaseClient<Database>, eid: string): Promise<DdAuditEntry[]> {
  const { data } = await raw(supabase)
    .from("dd_audit_log")
    .select("id, action, target, actor_id, at")
    .eq("engagement_id", eid)
    .order("at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Array<{ id: number; action: string; target: string | null; actor_id: string | null; at: string }>;

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const emailById = new Map<string, string>();
  if (actorIds.length) {
    const { data: profs } = await raw(supabase).from("profiles").select("id, email").in("id", actorIds);
    for (const p of (profs ?? []) as Array<{ id: string; email: string }>) emailById.set(p.id, p.email);
  }

  return rows.map((r) => ({ id: r.id, action: r.action, target: r.target, actor: r.actor_id ? emailById.get(r.actor_id) ?? "system" : "system", at: r.at }));
}

export async function ddAudit(
  supabase: SupabaseClient<Database>,
  input: {
    engagementId: string | null;
    actorId: string | null;
    action: string;
    target?: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await raw(supabase)
    .from("dd_audit_log")
    .insert({
      engagement_id: input.engagementId,
      actor_id: input.actorId,
      action: input.action,
      target: input.target ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
    });
}
