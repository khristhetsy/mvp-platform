import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// user_preferences isn't in the generated types — raw client.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function loadSignature(supabase: SupabaseClient<Database>, profileId: string): Promise<string> {
  const { data } = await raw(supabase)
    .from("user_preferences")
    .select("email_signature")
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data as { email_signature: string | null } | null)?.email_signature ?? "";
}

export async function saveSignature(
  supabase: SupabaseClient<Database>,
  profileId: string,
  signature: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await raw(supabase)
    .from("user_preferences")
    .upsert({ profile_id: profileId, email_signature: signature, updated_at: now }, { onConflict: "profile_id" });
  if (error) throw new Error(error.message);
}

// ── Default iCFO signature ───────────────────────────────────────────────────

// Self-contained, email-safe (inline styles only, no external image — a styled
// "iCFO" monogram badge). Returned as the effective signature when a user hasn't
// saved their own, and offered as a one-click template in the settings editor.
export const DEFAULT_ICFO_SIGNATURE = [
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e3a5f;line-height:1.5;">',
  '<div style="font-weight:bold;color:#0f2147;">KHRIS THETSY</div>',
  '<div style="color:#0f2147;">Founder and CEO</div>',
  '<div style="margin:6px 0;">',
  '<span style="display:inline-block;width:34px;height:34px;line-height:34px;background:#e6f1fb;border-radius:50%;text-align:center;color:#0c447c;font-weight:bold;font-size:11px;vertical-align:middle;">iCFO</span>',
  '<span style="padding-left:8px;font-weight:bold;color:#0c447c;font-size:13px;vertical-align:middle;">iCFO CAPITAL GLOBAL, INC</span>',
  "</div>",
  '<div style="font-style:italic;color:#1e3a5f;">"Elevating Your Capital Strategy"</div>',
  "<div>Office: (619) 956-9114 Ext 1003</div>",
  "<div>Direct: (858) 987-9803</div>",
  '<div>Calendly: <a href="https://calendly.com/icfo-khristhetsy" style="color:#185fa5;">calendly.com/icfo-khristhetsy</a></div>',
  '<div>Email: <a href="mailto:kthetsy@myicfos.com" style="color:#185fa5;">kthetsy@myicfos.com</a> | Website: <a href="https://www.icfocapital.com" style="color:#185fa5;">www.icfocapital.com</a></div>',
  '<div style="font-size:11px;color:#185fa5;margin-top:4px;">my linkedin | about us | events | icfo beverly hills | icfo newport beach | icfo la jolla | icfo san diego | icfo scottsdale | icfo palm springs | icfo singapore | icfo australia | icfo st louis | icfo maryland</div>',
  '<div style="font-size:10px;color:#94a3b8;margin-top:8px;line-height:1.5;">***** This e-mail, including any attachments, is solely for informational purposes, and we do not guarantee its factual content to be an accurate and complete statement of such data. The information contained in this e-mail should not be construed as an offer or a solicitation of an offer to buy or sell any securities or other financial investments. This e-mail is intended for the addressee\'s exclusive use and may contain confidential or privileged information.</div>',
  "</div>",
].join("");

/** The signature to use for a given saved value — falls back to the iCFO default. */
export function effectiveSignature(saved: string | null | undefined): string {
  const s = (saved ?? "").trim();
  return s.length > 0 ? s : DEFAULT_ICFO_SIGNATURE;
}

// ── Rich-signature helpers ──────────────────────────────────────────────────

const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "strike", "a", "br", "p", "div", "span",
  "img", "ul", "ol", "li", "font", "h1", "h2", "h3", "blockquote",
]);

// Full email bodies (especially inserted marketing templates) are table-based
// layouts — a signature allowlist would strip the structure and leave the email
// blank. Allow the standard email-safe structural/text tags on top of the base set.
const EMAIL_BODY_TAGS = new Set<string>([
  ...ALLOWED_TAGS,
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "colgroup", "col", "caption",
  "center", "hr", "small", "sub", "sup", "pre", "code", "dl", "dt", "dd",
  "h4", "h5", "h6", "figure", "figcaption", "address", "main", "section", "article", "header", "footer",
]);

/** Allowlist sanitizer: strips scripts/handlers/javascript: URLs and any tag
 *  outside `allowed` (keeping inner text). Inline styles/colors are preserved. */
function sanitizeAllowlist(html: string, allowed: Set<string>, maxLen: number): string {
  if (!html) return "";
  let out = html;
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta|svg|math|title|head|body|html)[\s\S]*?<\/\s*\1\s*>/gi, "");
  out = out.replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|svg|math|title|head|body|html)\b[^>]*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (m, tag: string) =>
    allowed.has(tag.toLowerCase()) ? m : "");
  return out.trim().slice(0, maxLen);
}

/** Conservative sanitizer for a self-authored email signature. */
export function sanitizeSignatureHtml(html: string, maxLen = 20000): string {
  return sanitizeAllowlist(html, ALLOWED_TAGS, maxLen);
}

/** Sanitize a full outgoing email body — permissive email-safe allowlist, 25MB cap. */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeAllowlist(html, EMAIL_BODY_TAGS, 26214400);
}

/** Plain-text rendering of a signature (for the email's text/plain part). */
export function signatureToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-3]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Whether a stored signature is HTML (vs legacy plain text). */
export function isHtmlSignature(sig: string): boolean {
  return /<[a-z!/][\s\S]*>/i.test(sig);
}
