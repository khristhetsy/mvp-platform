// Single source of brand tokens injected into MJML masters at compile time
// (build spec §4). Locked globally — the editor never exposes these; only the
// banner slot is editable per template.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/+$/, "");

export const EMAIL_BRAND = {
  gradientFrom: "#0A1A40",
  gradientTo: "#1A6CE4",
  /** Navy overlay applied over image banners for text contrast (§5). */
  bannerOverlayRgba: "rgba(10,26,64,0.64)",
  textColor: "#16223F",
  mutedColor: "#5A6B8C",
  linkColor: "#1A6CE4",
  fontStack: "Helvetica, Arial, sans-serif",
  /** Absolute, hosted logo — relative paths break in delivered mail. */
  logoUrl: process.env.EMAIL_LOGO_URL ?? `${APP_URL}/email-logo.png`,
  fromName: "iCFO Capital Global",
  fromEmail: "team@icapos.com",
  company: {
    legalName: "iCFO Capital Global, Inc.",
    addressLine: "La Jolla, CA 92037",
  },
  appUrl: APP_URL,
} as const;

export type EmailBrand = typeof EMAIL_BRAND;

/**
 * The mandatory footer, present in every compiled master. Acceptance criterion
 * (§8): the build fails if a master omits it. `{{unsubscribe_url}}` and the
 * other per-recipient tokens are merged at send time.
 */
export function brandFooterHtml(brand: EmailBrand = EMAIL_BRAND): string {
  const year = new Date().getFullYear();
  return [
    `<div style="font-family:${brand.fontStack};font-size:12px;line-height:1.6;color:${brand.mutedColor};text-align:center;padding:24px;">`,
    `<div>${brand.company.legalName} · ${brand.company.addressLine}</div>`,
    `<div style="margin-top:6px;">`,
    `<a href="{{unsubscribe_url}}" style="color:${brand.mutedColor};text-decoration:underline;">Unsubscribe</a>`,
    ` · <a href="${brand.appUrl}/preferences" style="color:${brand.mutedColor};text-decoration:underline;">Manage preferences</a>`,
    ` · <a href="{{view_in_browser_url}}" style="color:${brand.mutedColor};text-decoration:underline;">View in browser</a>`,
    `</div>`,
    `<div style="margin-top:6px;">You're receiving this because you opted in with ${brand.company.legalName}.</div>`,
    `<div style="margin-top:6px;">© ${year} ${brand.company.legalName}. All rights reserved.</div>`,
    `</div>`,
  ].join("");
}
