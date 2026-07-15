// Rewrite relative image/link URLs in outbound email HTML to absolute URLs.
//
// Delivered email has no <base>, so a relative src like "/email-logo.png" or
// "email-logo.png" can't resolve in a mail client and shows a broken image —
// even though it renders fine in the on-site preview (which resolves against the
// app origin). This normalizer runs on the Gmail send/reply paths so any
// template with relative asset paths ships with working images and links.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/+$/, "");

// Schemes/prefixes that are already resolvable and must be left untouched.
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** Resolve one URL value against the app origin. Absolute/data/cid/mailto/etc. pass through. */
function absolutizeUrl(raw: string, baseUrl: string): string {
  const url = raw.trim();
  if (!url) return raw;
  if (ABSOLUTE.test(url)) return url; // http:, https:, data:, cid:, mailto:, tel:, //cdn, #anchor
  if (url.startsWith("/")) return `${baseUrl}${url}`; // root-relative
  return `${baseUrl}/${url.replace(/^\.\//, "")}`; // path-relative ("logo.png", "./logo.png")
}

/**
 * Rewrite relative `src` and `href` attribute values in an HTML string to
 * absolute URLs rooted at the app origin (NEXT_PUBLIC_APP_URL, default
 * https://icapos.com). Absolute URLs, data:, cid:, mailto:, tel:, protocol-
 * relative (//), and #anchors are left unchanged.
 */
export function absolutizeEmailHtml(html: string | null | undefined, baseUrl: string = APP_URL): string {
  if (!html) return "";
  const base = baseUrl.replace(/\/+$/, "");
  return html.replace(
    /\b(src|href)\s*=\s*(["'])(.*?)\2/gi,
    (_m, attr: string, quote: string, value: string) => `${attr}=${quote}${absolutizeUrl(value, base)}${quote}`,
  );
}
