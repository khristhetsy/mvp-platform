// Locale list used across the app (no URL-prefix routing — locale is cookie-based).
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
