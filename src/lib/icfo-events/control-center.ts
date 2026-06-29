import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export type ControlAuditEntry = {
  id: string;
  action: string;
  target: string | null;
  actorName: string;
  createdAt: string;
};

export type ControlSummary = {
  registered: number;
  connections: number;
  audit: ControlAuditEntry[];
};

async function safeCount(p: PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    const { count } = await p;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function loadControlSummary(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<ControlSummary> {
  const db = raw(supabase);
  const [registered, connections, logRes] = await Promise.all([
    safeCount(db.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", eventId)),
    safeCount(db.from("networking_connections").select("id", { count: "exact", head: true }).eq("event_id", eventId)),
    db
      .from("event_moderation_log")
      .select("id, action, target, created_at, profiles:actor_id(full_name, email)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  type LogRow = {
    id: string;
    action: string;
    target: string | null;
    created_at: string;
    profiles?: { full_name: string | null; email: string | null } | null;
  };
  const audit = ((logRes.data ?? []) as unknown as LogRow[]).map((r) => ({
    id: r.id,
    action: r.action,
    target: r.target,
    actorName: r.profiles?.full_name ?? r.profiles?.email ?? "Staff",
    createdAt: r.created_at,
  }));

  return { registered, connections, audit };
}
