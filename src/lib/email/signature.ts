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
  await raw(supabase)
    .from("user_preferences")
    .upsert({ profile_id: profileId, email_signature: signature, updated_at: now }, { onConflict: "profile_id" });
}

// ── Rich-signature helpers ──────────────────────────────────────────────────

const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "strike", "a", "br", "p", "div", "span",
  "img", "ul", "ol", "li", "font", "h1", "h2", "h3", "blockquote",
]);

/**
 * Conservative allowlist sanitizer for a self-authored email signature. Strips
 * scripts/handlers/javascript: URLs and any tag outside the allowlist (keeping
 * inner text). Inline styles/colors are preserved for formatting.
 */
export function sanitizeSignatureHtml(html: string): string {
  if (!html) return "";
  let out = html;
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta|svg|math|title|head|body|html)[\s\S]*?<\/\s*\1\s*>/gi, "");
  out = out.replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|svg|math|title|head|body|html)\b[^>]*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (m, tag: string) =>
    ALLOWED_TAGS.has(tag.toLowerCase()) ? m : "");
  return out.trim().slice(0, 20000);
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
