import { writeAuditLog } from "@/lib/data/audit";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import type { CrmExportEntityType, CrmExportFormat } from "@/lib/crm-connectors/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/supabase/types";

export async function logCrmExportPreviewed(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  input: { entityType: CrmExportEntityType; rowCount: number },
): Promise<void> {
  await writeAuditLog(supabase, {
    userId: profile.id,
    action: "admin.crm_export_previewed",
    entityType: "crm_export",
    entityId: input.entityType,
    metadata: {
      entity_type: input.entityType,
      row_count: input.rowCount,
      generated_by: profile.id,
      timestamp: new Date().toISOString(),
    },
  });

  emitOperationalEvent(supabase, {
    eventType: "admin.crm_export_previewed",
    eventCategory: "system",
    entityType: "crm_export",
    entityId: input.entityType,
    actorUserId: profile.id,
    actorRole: profile.role,
    title: "CRM export previewed",
    description: `${input.entityType} — ${input.rowCount} row(s). No live sync.`,
    metadata: { entity_type: input.entityType, row_count: input.rowCount },
    sourceModule: "crm_connectors",
    visibility: "admin_only",
  });
}

export async function logCrmExportDownloaded(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  input: { entityType: CrmExportEntityType; rowCount: number; format: CrmExportFormat },
): Promise<void> {
  await writeAuditLog(supabase, {
    userId: profile.id,
    action: "admin.crm_export_downloaded",
    entityType: "crm_export",
    entityId: input.entityType,
    metadata: {
      entity_type: input.entityType,
      row_count: input.rowCount,
      format: input.format,
      generated_by: profile.id,
      timestamp: new Date().toISOString(),
    },
  });

  emitOperationalEvent(supabase, {
    eventType: "admin.crm_export_downloaded",
    eventCategory: "system",
    entityType: "crm_export",
    entityId: input.entityType,
    actorUserId: profile.id,
    actorRole: profile.role,
    title: "CRM export downloaded",
    description: `${input.entityType} (${input.format}) — ${input.rowCount} row(s).`,
    metadata: { entity_type: input.entityType, row_count: input.rowCount, format: input.format },
    sourceModule: "crm_connectors",
    visibility: "admin_only",
  });
}
