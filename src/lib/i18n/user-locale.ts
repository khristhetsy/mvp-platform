import type { AppLocale } from "@/lib/i18n/locale";

/** English only. Kept so existing email and digest callers keep working. */
export async function getUserLocale(_profileId: string): Promise<AppLocale> {
  return "en";
}

export async function getUserLocaleByEmail(_email: string): Promise<AppLocale> {
  return "en";
}
