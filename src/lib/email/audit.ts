import { writeAuditLog } from "@/lib/data/audit";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import type { EmailTemplateType } from "@/lib/email/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/supabase/types";

export async function logEmailDraftGenerated(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  input: {
    templateType: EmailTemplateType;
    entityType: string | null;
    entityId: string | null;
    sourceActionId: string | null;
    recipientCount: number;
  },
): Promise<string | null> {
  await writeAuditLog(supabase, {
    userId: profile.id,
    action: "email_draft_generated",
    entityType: input.entityType ?? "email_draft",
    entityId: input.entityId ?? input.sourceActionId,
    metadata: {
      template_type: input.templateType,
      actor_role: profile.role,
      entity_type: input.entityType,
      entity_id: input.entityId,
      source_action_id: input.sourceActionId,
      recipient_count: input.recipientCount,
      timestamp: new Date().toISOString(),
    },
  });

  emitOperationalEvent(supabase, {
    eventType: "email_draft_generated",
    eventCategory: "system",
    entityType: input.entityType ?? "email_draft",
    entityId: input.entityId,
    actorUserId: profile.id,
    actorRole: profile.role,
    title: "Email draft generated",
    description: `Template: ${input.templateType}. Draft only — not sent.`,
    metadata: {
      template_type: input.templateType,
      source_action_id: input.sourceActionId,
    },
    sourceModule: "email",
    visibility: profile.role === "founder" ? "founder" : profile.role === "investor" ? "investor" : "admin_only",
  });

  return null;
}
