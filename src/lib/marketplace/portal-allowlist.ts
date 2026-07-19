// COMPLIANCE-MAINTAINED FILE — reviewed quarterly.
// Allowlist of FINRA-registered funding portals a Reg CF listing may link to.
// Used by the listing-creation validation (separate ticket). A hostname not on
// this list routes a submission to `pending_review` rather than hard-failing —
// new portals register with FINRA regularly.

export const PORTAL_ALLOWLIST: readonly string[] = [
  "wefunder.com",
  "startengine.com",
  "republic.com",
  "dealmaker.tech",
  "netcapital.com",
  "honeycombcredit.com",
  "mainvest.com",
];

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/** Is the given URL https and hosted on an allowlisted portal? */
export function isAllowlistedPortalUrl(url: string): { https: boolean; allowlisted: boolean; host: string | null } {
  try {
    const u = new URL(url);
    const host = normalizeHost(u.hostname);
    const https = u.protocol === "https:";
    const allowlisted = PORTAL_ALLOWLIST.some((h) => host === h || host.endsWith(`.${h}`));
    return { https, allowlisted, host };
  } catch {
    return { https: false, allowlisted: false, host: null };
  }
}

/** Render-time guard for the public card: only https URLs may be linked. */
export function isSafePortalHref(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
