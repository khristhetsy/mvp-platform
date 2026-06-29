// Per-recipient email localization. Transactional emails are sent outside any
// request scope, so we can't use next-intl's request-bound getTranslations.
// Instead we load the message catalog for an explicit locale and resolve keys
// under the "emails" namespace with simple {var} interpolation.

import type { AppLocale } from "@/lib/i18n/locale";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

type Dict = Record<string, unknown>;
const CATALOGS: Record<AppLocale, Dict> = { en: en as Dict, es: es as Dict };

function deepGet(obj: Dict, path: string): string | undefined {
  const v = path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Dict)[k] : undefined), obj);
  return typeof v === "string" ? v : undefined;
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export type EmailT = (key: string, vars?: Record<string, string | number>) => string;

/** Build a translator bound to a recipient's locale. Keys are relative to the
 *  "emails" namespace. Falls back to English, then to the raw key. */
export function emailTranslator(locale: AppLocale): EmailT {
  return (key, vars) => {
    const full = `emails.${key}`;
    const resolved = deepGet(CATALOGS[locale], full) ?? deepGet(CATALOGS.en, full) ?? key;
    return interpolate(resolved, vars);
  };
}
