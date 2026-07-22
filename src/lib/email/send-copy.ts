// Send a rendered template copy via Resend (build spec §6).
//
// Self-contained so the existing marketing send layer is untouched. Reuses the
// single source of truth for suppression (isUnsubscribed → marketing_unsubscribes)
// and the existing signed unsubscribe token — NO send path may bypass suppression
// (§6, load-bearing for compliance), including test sends.

import { getResendApiKey } from "@/lib/env";
import { isUnsubscribed } from "@/lib/marketing/contacts";
import { makeUnsubscribeToken } from "@/lib/marketing/send";
import { EMAIL_BRAND } from "./brand";
import { renderCopyHtml } from "./render-copy";
import type { CopyWithMaster } from "./masters-queries";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Fill the per-recipient send-time tokens the master HTML left in place. */
function fillSendTokens(html: string, recipient: { email: string; firstName?: string | null }): string {
  const unsubscribeUrl = `${EMAIL_BRAND.appUrl}/unsubscribe?token=${makeUnsubscribeToken(recipient.email)}`;
  const values: Record<string, string> = {
    unsubscribe_url: unsubscribeUrl,
    view_in_browser_url: EMAIL_BRAND.appUrl,
    first_name: recipient.firstName?.trim() || "there",
    last_name: "",
    company: "",
    email: recipient.email,
  };
  return html.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key: string) => values[key.toLowerCase()] ?? "");
}

export type SendCopyResult =
  | { ok: true; resendId: string | null }
  | { ok: false; reason: "suppressed" | "not_configured" | "send_failed"; message: string };

/**
 * Render a copy and send it to one recipient. Subject is the copy name; test
 * sends prefix "[TEST]". Suppressed recipients are refused, not sent to.
 */
export async function sendCopyToRecipient(
  copy: CopyWithMaster,
  recipient: { email: string; firstName?: string | null },
  opts: { subject: string; test?: boolean } = { subject: "" },
): Promise<SendCopyResult> {
  if (await isUnsubscribed(recipient.email)) {
    return { ok: false, reason: "suppressed", message: `${recipient.email} has unsubscribed — not sent.` };
  }

  const apiKey = getResendApiKey();
  if (!apiKey) {
    return { ok: false, reason: "not_configured", message: "Resend is not configured (RESEND_API_KEY missing)." };
  }

  const html = fillSendTokens(renderCopyHtml(copy, "send"), recipient);
  const subject = opts.test ? `[TEST] ${opts.subject || copy.name}` : opts.subject || copy.name;
  const unsubscribeUrl = `${EMAIL_BRAND.appUrl}/unsubscribe?token=${makeUnsubscribeToken(recipient.email)}`;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${EMAIL_BRAND.fromName} <${EMAIL_BRAND.fromEmail}>`,
        to: recipient.email,
        subject,
        html,
        // One-click unsubscribe (RFC 8058) — same route as the footer link.
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: "send_failed", message: `Resend returned ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, resendId: json?.id ?? null };
  } catch (err) {
    return { ok: false, reason: "send_failed", message: err instanceof Error ? err.message : "Send failed." };
  }
}
