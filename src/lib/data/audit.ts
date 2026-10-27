import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function writeAuditLog(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  // While staff act as a founder the signed in user is the founder, so record who really did it.
  let actingStaffId: string | null = null;
  try {
    const { actingStaffId: staffId } = await import("@/lib/admin/acting-central");
    actingStaffId = await staffId();
  } catch {
    // Outside a request (cron), or acting is not configured: nothing to add.
  }
  const metadata = actingStaffId ? { ...(input.metadata ?? {}), acting_staff_id: actingStaffId } : (input.metadata ?? null);

  await supabase.from("audit_logs").insert({
    user_id: input.userId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata,
  });
}
