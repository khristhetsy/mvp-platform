// Operations Hub v2 settings (single-row ops_hub_settings) + timezone helpers.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

const db = serviceRoleClientUntyped;

export type HubEditScope = "all_admins" | "owner_only";
export interface HubSettings {
  driftDetection: boolean;
  driftAutoAdd: boolean;
  advisoryEnabled: boolean;
  runResetTz: string;
  escalationPastDueDays: number;
  playbookEditScope: HubEditScope;
}

export const HUB_DEFAULTS: HubSettings = {
  driftDetection: true,
  driftAutoAdd: false,
  advisoryEnabled: true,
  runResetTz: "Europe/Paris",
  escalationPastDueDays: 21,
  playbookEditScope: "all_admins",
};

export async function getHubSettings(): Promise<HubSettings> {
  try {
    const { data } = await db().from("ops_hub_settings").select("*").eq("id", 1).maybeSingle();
    if (!data) return HUB_DEFAULTS;
    return {
      driftDetection: data.drift_detection ?? true,
      driftAutoAdd: data.drift_auto_add ?? false,
      advisoryEnabled: data.advisory_enabled ?? true,
      runResetTz: data.run_reset_tz ?? "Europe/Paris",
      escalationPastDueDays: data.escalation_past_due_days ?? 21,
      playbookEditScope: (data.playbook_edit_scope as HubEditScope) ?? "all_admins",
    };
  } catch {
    return HUB_DEFAULTS;
  }
}

export async function updateHubSettings(patch: Partial<HubSettings>): Promise<void> {
  const u: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
  if (patch.driftDetection !== undefined) u.drift_detection = patch.driftDetection;
  if (patch.driftAutoAdd !== undefined) u.drift_auto_add = patch.driftAutoAdd;
  if (patch.advisoryEnabled !== undefined) u.advisory_enabled = patch.advisoryEnabled;
  if (patch.runResetTz !== undefined) u.run_reset_tz = patch.runResetTz;
  if (patch.escalationPastDueDays !== undefined) u.escalation_past_due_days = Math.max(7, Math.min(60, Math.round(patch.escalationPastDueDays)));
  if (patch.playbookEditScope !== undefined) u.playbook_edit_scope = patch.playbookEditScope;
  const { error } = await db().from("ops_hub_settings").upsert(u, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

/** Current calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function todayInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Current hour (0–23) in the given IANA timezone. */
export function hourInTz(tz: string): number {
  try {
    const s = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date());
    const h = parseInt(s, 10);
    return Number.isFinite(h) ? h % 24 : new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}
