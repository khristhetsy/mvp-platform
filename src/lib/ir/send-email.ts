import "server-only";

/**
 * Email an investor from their Share Project record, with iCapOS (Resend, from the
 * verified platform address, replies to the sender) or the sender's own Gmail. The
 * investor's address is read here on the server and never sent to the browser.
 * Optionally links the founder's published one-pager (/f/[slug]).
 */
import { db } from "@/lib/ir/db";
import { getAppUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/send-email";
import { sendViaGmail } from "@/lib/integrations/gmail-send";
import { gmailError } from "@/lib/founder-outreach/deliver-reach-out";

export type SendVia = "icapos" | "gmail";

/** The founder's published one-pager, or null when the company has none published. */
export async function onePagerFor(companyId: string | null): Promise<{ url: string; companyName: string | null } | null> {
  if (!companyId) return null;
  const { data } = await db().from("companies").select("slug, is_published, company_name").eq("id", companyId).maybeSingle();
  const c = data as { slug: string | null; is_published: boolean | null; company_name: string | null } | null;
  const base = getAppUrl();
  if (!c?.slug || !c.is_published || !base) return null;
  return { url: `${base.replace(/\/$/, "")}/f/${c.slug}`, companyName: c.company_name };
}

export async function investorHasEmail(contactId: string): Promise<boolean> {
  return !!(await investorEmail(contactId));
}
async function investorEmail(contactId: string): Promise<string | null> {
  const { data } = await db().from("crm_contacts").select("email").eq("id", contactId).maybeSingle();
  const e = (data as { email: string | null } | null)?.email?.trim() ?? "";
  return e.includes("@") ? e : null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function toHtml(body: string, onePager: { url: string; companyName: string | null } | null): string {
  const paras = body.trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const link = onePager ? `<p style="margin:0 0 14px;"><a href="${esc(onePager.url)}" style="color:#4338CA;font-weight:600;">View the ${esc(onePager.companyName ?? "founder")} one-pager</a></p>` : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2937;">${paras}${link}</div>`;
}

export async function sendInvestorEmail(input: {
  investorContactId: string; companyId: string | null; subject: string; body: string; via: SendVia; includeOnePager: boolean;
  sender: { id: string; email: string | null; name: string | null };
  /** Resend tags so opens / clicks can be traced back (iCapOS sends only). */
  tags?: Array<{ name: string; value: string }>;
}): Promise<{ ok: true; onePager: boolean } | { ok: false; error: string; status: number }> {
  const to = await investorEmail(input.investorContactId);
  if (!to) return { ok: false, status: 400, error: "This investor has no email on file. Add one on their Sales Hub contact, then send." };
  const onePager = input.includeOnePager ? await onePagerFor(input.companyId) : null;
  if (input.includeOnePager && !onePager) return { ok: false, status: 400, error: "The founder's one-pager isn't published yet, so there's no link to send." };
  const text = onePager ? `${input.body.trim()}\n\nOne-pager: ${onePager.url}` : input.body.trim();
  const html = toHtml(input.body, onePager);

  if (input.via === "gmail") {
    const r = await sendViaGmail({ userId: input.sender.id, to, subject: input.subject, body: text, html });
    if ("error" in r) return { ok: false, status: 502, error: gmailError(r.error) };
    return { ok: true, onePager: !!onePager };
  }
  const sent = await sendEmail({ to, subject: input.subject, html, text, replyTo: input.sender.email ?? undefined, fromName: input.sender.name ?? undefined, tags: input.tags });
  if (!sent) return { ok: false, status: 502, error: "iCapOS couldn't send that email. Check the email settings in System health, or send with Gmail." };
  return { ok: true, onePager: !!onePager };
}
