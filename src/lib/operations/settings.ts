// Operations Hub settings — SLA thresholds + default escalation manager.
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type OpsSettings = {
  onboardingSlaDays: number;
  diligenceSlaDays: number;
  defaultManagerId: string | null;
  emailEscalations: boolean;
};

export const OPS_DEFAULTS: OpsSettings = { onboardingSlaDays: 7, diligenceSlaDays: 3, defaultManagerId: null, emailEscalations: false };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export async function getOpsSettings(): Promise<OpsSettings> {
  try {
    const { data } = await db().from("ops_settings").select("onboarding_sla_days, diligence_sla_days, default_manager_id, email_escalations").eq("id", "default").maybeSingle();
    if (!data) return OPS_DEFAULTS;
    return {
      onboardingSlaDays: data.onboarding_sla_days ?? OPS_DEFAULTS.onboardingSlaDays,
      diligenceSlaDays: data.diligence_sla_days ?? OPS_DEFAULTS.diligenceSlaDays,
      defaultManagerId: data.default_manager_id ?? null,
      emailEscalations: Boolean(data.email_escalations),
    };
  } catch {
    return OPS_DEFAULTS;
  }
}

export async function updateOpsSettings(patch: Partial<OpsSettings>): Promise<void> {
  const update: Record<string, unknown> = { id: "default", updated_at: new Date().toISOString() };
  if (patch.onboardingSlaDays !== undefined) update.onboarding_sla_days = Math.max(1, Math.min(90, Math.round(patch.onboardingSlaDays)));
  if (patch.diligenceSlaDays !== undefined) update.diligence_sla_days = Math.max(1, Math.min(90, Math.round(patch.diligenceSlaDays)));
  if (patch.defaultManagerId !== undefined) update.default_manager_id = patch.defaultManagerId || null;
  if (patch.emailEscalations !== undefined) update.email_escalations = patch.emailEscalations;
  const { error } = await db().from("ops_settings").upsert(update, { onConflict: "id" });
  if (error) throw new Error(error.message);
}
