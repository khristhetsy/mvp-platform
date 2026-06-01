import { buildEmailDraft } from "@/lib/email/draft-builder";
import { listTemplatesForRole } from "@/lib/email/templates";
import type { EmailTemplateType } from "@/lib/email/types";
import type { Profile } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export function isEmailDraftIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("draft") &&
    (lower.includes("email") ||
      lower.includes("follow-up") ||
      lower.includes("follow up") ||
      lower.includes("reminder") ||
      lower.includes("intro"))
  );
}

function resolveTemplateFromMessage(message: string, role: Profile["role"]): EmailTemplateType | null {
  const lower = message.toLowerCase();
  const allowed = listTemplatesForRole(role);
  if (lower.includes("spv") && lower.includes("requirement")) {
    return allowed.find((t) => t.type === "investor_spv_requirement_reminder")?.type ?? null;
  }
  if (lower.includes("intro") && lower.includes("investor")) {
    return allowed.find((t) => t.type === "founder_investor_intro_followup")?.type ?? null;
  }
  if (lower.includes("compliance")) {
    return allowed.find((t) => t.type === "compliance_followup")?.type ?? null;
  }
  if (lower.includes("meeting")) {
    return allowed.find((t) => t.type === "meeting_followup")?.type ?? null;
  }
  if (lower.includes("onboarding")) {
    return allowed.find((t) => t.type === "founder_onboarding_reminder")?.type ?? null;
  }
  if (lower.includes("company") && lower.includes("review")) {
    return allowed.find((t) => t.type === "admin_company_review_followup")?.type ?? null;
  }
  return allowed[0]?.type ?? null;
}

export async function formatEmailDraftForAssistant(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  message: string,
  entityType?: string | null,
  entityId?: string | null,
): Promise<string> {
  const templateType = resolveTemplateFromMessage(message, profile.role);
  if (!templateType) {
    return "I can help draft emails for allowed workflow templates in your role. Open an Action or workspace and use **Draft email**, or specify a follow-up type (intro, SPV reminder, compliance). **Nothing is sent automatically.**";
  }

  const result = await buildEmailDraft(supabase, profile, {
    templateType,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
  });

  if ("error" in result) {
    return `I could not generate that draft: ${result.error}. Use **Draft email** in your workspace for full controls.`;
  }

  const { draft } = result;
  return [
    "**Email draft (not sent)**",
    "",
    `**Subject:** ${draft.subject}`,
    "",
    draft.body,
    "",
    "**Safety notes:**",
    ...draft.safetyNotes.map((n) => `- ${n}`),
    "",
    "Copy this into your own email client to send. CapitalOS does not send emails automatically.",
  ].join("\n");
}
