import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

const SUPPORTED_LOCALES = ["en", "es"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

function isSupportedLocale(value: string | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

function detectLocale(cookieValue: string | undefined, acceptLanguage: string): Locale {
  if (isSupportedLocale(cookieValue)) return cookieValue;
  const browserLang = acceptLanguage.split(",")[0]?.split("-")[0]?.toLowerCase();
  if (isSupportedLocale(browserLang)) return browserLang;
  return "en";
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const localeCookie = cookieStore.get("capitalos-locale")?.value;
  const acceptLanguage = headerStore.get("accept-language") ?? "";

  const locale = detectLocale(localeCookie, acceptLanguage);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
