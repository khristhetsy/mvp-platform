import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ pid: z.number().int().positive() });

/**
 * POST /api/admin/db-health/cancel-query: cancel one query that has been running
 * for 5 seconds or more. The database function refuses any other connection, so
 * replication and system work cannot be cancelled from here. System access only.
 */
export async function POST(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the query's pid." }, { status: 400 });

  // The health tables are not in the generated types, so use the untyped client as the other db-health code does.
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { data, error } = await admin.rpc("db_health_cancel_query", { p_pid: parsed.data.pid, p_min_seconds: 5 });
  if (error) return NextResponse.json({ error: "Couldn't cancel the query. Has the Database health SQL been run?" }, { status: 500 });
  if (data !== true) return NextResponse.json({ ok: false, cancelled: false, reason: "That query already finished, or is not one that can be cancelled." });

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "db_health.query_cancelled",
    entityType: "db_query",
    metadata: { pid: parsed.data.pid },
  }).catch(() => {});

  // Note it on the open incident, if there is one.
  const when = new Date().toISOString().slice(0, 16).replace("T", " ");
  const { data: open } = await admin.from("db_health_incidents").select("id").is("ended_at", null).limit(1).maybeSingle();
  if (open) {
    await admin
      .from("db_health_incidents")
      .update({ action_taken: `Query cancelled by ${auth.profile.full_name ?? auth.profile.email ?? "an admin"} at ${when} UTC` })
      .eq("id", (open as { id: number }).id);
  }
  return NextResponse.json({ ok: true, cancelled: true });
}
