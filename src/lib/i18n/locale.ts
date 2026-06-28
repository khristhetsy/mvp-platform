import { getLocale } from "next-intl/server";

export type AppLocale = "en" | "es";

/** Current request locale on the server (cookie-driven). Falls back to "en"
 *  outside a request scope (e.g. cron, scripts) where there's no cookie. */
export async function getServerLocale(): Promise<AppLocale> {
  try {
    const locale = await getLocale();
    return locale === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

export function languageName(locale: string): string {
  return locale === "es" ? "Spanish (español)" : "English";
}

/** Instruction appended to AI system prompts so output matches the user's language. */
export function aiLanguageInstruction(locale: AppLocale): string {
  if (locale === "es") {
    return "\n\nIMPORTANT: Write your entire response in natural, professional Spanish (español). Do not include any English.";
  }
  return "";
}
