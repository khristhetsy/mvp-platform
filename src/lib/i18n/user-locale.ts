import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { AppLocale } from "@/lib/i18n/locale";

/** The user's persisted language preference — for emails/digests sent outside a
 *  request scope (where there's no cookie). Defaults to "en". */
export async function getUserLocale(profileId: string): Promise<AppLocale> {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin.from("profiles").select("locale").eq("id", profileId).maybeSingle();
    return (data as { locale?: string } | null)?.locale === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

/** Same as getUserLocale but keyed by email — for email builders that only have
 *  the recipient's address. Defaults to "en" (unknown recipients, e.g. invitees). */
export async function getUserLocaleByEmail(email: string): Promise<AppLocale> {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin.from("profiles").select("locale").ilike("email", email).maybeSingle();
    return (data as { locale?: string } | null)?.locale === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}
