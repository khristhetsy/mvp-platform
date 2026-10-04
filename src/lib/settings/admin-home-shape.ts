/**
 * Company-wide admin Home settings, chosen by a super admin from the gear on the top bar
 * and applied to every admin user. Client-safe (no server imports).
 *  - style: which of the 10 Home designs the app grid uses (1 to 10)
 *  - layout: "top" = Odoo-style top menu, "side" = the classic side menu
 *  - startPage: where admins land after signing in, the Home grid or the Dashboard
 */
export type AdminHomeLayout = "top" | "side";
export type AdminHomeStartPage = "home" | "dashboard";
export type AdminHomeSettings = { style: number; layout: AdminHomeLayout; startPage: AdminHomeStartPage };

export const ADMIN_HOME_KEY = "admin_home";
/** The 10 approved Home designs, in order (style 1 to 10). */
export const ADMIN_HOME_STYLES = [
  "Navy banner",
  "Brand blue",
  "Navy night",
  "Centered search",
  "Grouped by work",
  "Brand rail",
  "Emblem watermark",
  "Cards with descriptions",
  "Brand blue icons",
  "Split hero",
] as const;
export const ADMIN_HOME_STYLE_COUNT = ADMIN_HOME_STYLES.length;
export const DEFAULT_ADMIN_HOME: AdminHomeSettings = { style: 1, layout: "top", startPage: "home" };

/** Accept whatever is stored or posted and return a valid settings object. */
export function normalizeAdminHome(raw: unknown): AdminHomeSettings {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof AdminHomeSettings, unknown>>;
  const n = Number(v.style);
  return {
    style: Number.isInteger(n) && n >= 1 && n <= ADMIN_HOME_STYLE_COUNT ? n : DEFAULT_ADMIN_HOME.style,
    layout: v.layout === "side" ? "side" : "top",
    startPage: v.startPage === "dashboard" ? "dashboard" : "home",
  };
}

/** Where an admin lands after signing in. */
export function adminStartPath(settings: AdminHomeSettings): string {
  return settings.startPage === "dashboard" ? "/admin" : "/admin/home";
}
