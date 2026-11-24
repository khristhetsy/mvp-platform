export type AppLocale = "en";

/** The app is English only. Kept async so existing callers keep working. */
export async function getServerLocale(): Promise<AppLocale> {
  return "en";
}

export function languageName(_locale: string): string {
  return "English";
}

/** No extra language instruction is needed for AI prompts (English only). */
export function aiLanguageInstruction(_locale: AppLocale): string {
  return "";
}
