import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Per-founder Deploy settings: notification toggles + a do-not-contact list.
 * The do-not-contact entries (plain emails or bare domains) are excluded from
 * this founder's sends on top of the global unsubscribe suppression.
 */

export type DeployPreferences = {
  notifications: Record<string, boolean>;
  doNotContact: string[];
};

export const DEFAULT_DEPLOY_PREFERENCES: DeployPreferences = {
  notifications: { sent: true, opened: true, reviewed: true, responded: true, followup: true, autopause: true, digest: false },
  doNotContact: [],
};

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** Normalize a do-not-contact list: trim, lowercase, drop blanks/dupes. */
export function normalizeDoNotContact(raw: string[]): string[] {
  const out = new Set<string>();
  for (const entry of raw) {
    const v = String(entry ?? "").trim().toLowerCase();
    if (v) out.add(v);
  }
  return [...out];
}

/**
 * True when an email is covered by a do-not-contact list — either an exact
 * email match or a bare-domain match (e.g. "competitor.com" blocks anyone
 * @competitor.com).
 */
export function matchesDoNotContact(email: string, list: string[]): boolean {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  const domain = e.includes("@") ? e.slice(e.indexOf("@") + 1) : e;
  for (const raw of list) {
    const entry = raw.trim().toLowerCase();
    if (!entry) continue;
    if (entry.includes("@")) {
      if (entry === e) return true;
    } else if (entry === domain) {
      return true;
    }
  }
  return false;
}

export async function getDeployPreferences(companyId: string): Promise<DeployPreferences> {
  try {
    const { data } = await db()
      .from("founder_deploy_preferences")
      .select("prefs, do_not_contact")
      .eq("company_id", companyId)
      .maybeSingle();
    const row = data as { prefs?: Record<string, boolean>; do_not_contact?: string[] } | null;
    if (!row) return DEFAULT_DEPLOY_PREFERENCES;
    return {
      notifications: { ...DEFAULT_DEPLOY_PREFERENCES.notifications, ...(row.prefs ?? {}) },
      doNotContact: Array.isArray(row.do_not_contact) ? row.do_not_contact : [],
    };
  } catch {
    return DEFAULT_DEPLOY_PREFERENCES;
  }
}

export async function setDeployPreferences(
  companyId: string,
  prefs: DeployPreferences,
): Promise<boolean> {
  try {
    const { error } = await db()
      .from("founder_deploy_preferences")
      .upsert(
        {
          company_id: companyId,
          prefs: prefs.notifications,
          do_not_contact: normalizeDoNotContact(prefs.doNotContact),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" },
      );
    return !error;
  } catch {
    return false;
  }
}

/** The founder's do-not-contact list for a company (used by the send pass). */
export async function getDoNotContactList(companyId: string): Promise<string[]> {
  try {
    const { data } = await db()
      .from("founder_deploy_preferences")
      .select("do_not_contact")
      .eq("company_id", companyId)
      .maybeSingle();
    const list = (data as { do_not_contact?: string[] } | null)?.do_not_contact;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
