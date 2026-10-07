/**
 * Support by email.
 *
 * - Replies: every email to a founder about a request sets Reply-To to
 *   reply+sup<request id>@<inbound domain>. When the founder answers that
 *   email, the inbound webhook (/api/email/inbound) adds it to the request as
 *   their reply.
 * - New requests: an email to support@<inbound domain> from a founder's own
 *   address opens a new request on the Email channel.
 *
 * Only the founder's own address is accepted, so nobody can write into a
 * request by guessing its address.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { inboundDomain } from "@/lib/email/inbox";

const PREFIX = "sup";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** Inbound mail is set up when the domain is configured for this deploy. */
export function supportInboundEnabled(): boolean {
  return Boolean(process.env.INBOUND_EMAIL_DOMAIN?.trim() && process.env.INBOUND_WEBHOOK_SECRET?.trim());
}

/** reply+sup<uuid without dashes>@domain, or null when inbound mail is not set up. */
export function supportReplyAddress(requestId: string): string | null {
  if (!supportInboundEnabled()) return null;
  return `reply+${PREFIX}${requestId.replace(/-/g, "")}@${inboundDomain()}`;
}

export function supportInboxAddress(): string {
  return `support@${inboundDomain()}`;
}

/** The request id inside a reply token, or null when the token isn't a support one. */
export function requestIdFromToken(token: string): string | null {
  const m = /^sup([0-9a-f]{32})$/i.exec(token);
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** True when one of the recipients is the support inbox. */
export function isSupportInbox(addresses: string[]): boolean {
  const target = supportInboxAddress().toLowerCase();
  return addresses.some((a) => a.toLowerCase().includes(target));
}

/** Drop the quoted earlier email below a reply ("On ... wrote:", "> ..." lines). */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+wrote:\s*$/i.test(line.trim()) || /^-{2,}\s*Original Message/i.test(line.trim()) || /^From: .+/i.test(line.trim())) break;
    if (line.trim().startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

export function plainFromEmail(text: string | null | undefined, html: string | null | undefined): string {
  const raw = text?.trim()
    ? text
    : (html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  return stripQuotedReply(raw).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").slice(0, 4000);
}

export type InboundResult = { matched: boolean; reason?: string; requestId?: string };

/** A founder answered a support email. Adds their reply to the request. */
export async function recordSupportEmailReply(input: {
  requestId: string;
  fromEmail: string;
  text: string | null;
  html: string | null;
}): Promise<InboundResult> {
  const { data: req } = await db().from("support_requests").select("id, founder_id, status").eq("id", input.requestId).maybeSingle();
  const request = req as { id: string; founder_id: string; status: string } | null;
  if (!request) return { matched: false, reason: "no request" };
  const { data: prof } = await db().from("profiles").select("email").eq("id", request.founder_id).maybeSingle();
  const founderEmail = (prof as { email: string | null } | null)?.email?.trim().toLowerCase();
  if (!founderEmail || founderEmail !== input.fromEmail.trim().toLowerCase()) return { matched: false, reason: "sender is not the founder" };

  const body = plainFromEmail(input.text, input.html);
  if (!body) return { matched: false, reason: "empty reply" };
  const { addSupportMessage } = await import("@/lib/support/support");
  const r = await addSupportMessage(db() as unknown as SupabaseClient<Database>, { requestId: request.id, authorUserId: request.founder_id, authorRole: "founder", body });
  if ("error" in r) return { matched: false, reason: r.error };
  // A reply to a resolved request reopens it, like a reply in the app.
  if (request.status === "resolved") {
    await db().from("support_requests").update({ status: "open", resolved_at: null, updated_at: new Date().toISOString() }).eq("id", request.id);
  }
  const { onFounderReply } = await import("@/lib/support/care");
  await onFounderReply(request.id, body).catch(() => {});
  return { matched: true, requestId: request.id };
}

/** A founder emailed the support inbox. Opens a new request on the Email channel. */
export async function openSupportRequestFromEmail(input: {
  fromEmail: string;
  subject: string | null;
  text: string | null;
  html: string | null;
}): Promise<InboundResult> {
  const { data: prof } = await db()
    .from("profiles")
    .select("id, role")
    .ilike("email", input.fromEmail.trim().replace(/[%_\\]/g, (c) => `\\${c}`))
    .maybeSingle();
  const founder = prof as { id: string; role: string } | null;
  if (!founder || founder.role !== "founder") return { matched: false, reason: "sender is not a founder" };
  const { data: comp } = await db().from("companies").select("id").eq("founder_id", founder.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  const companyId = (comp as { id: string } | null)?.id;
  if (!companyId) return { matched: false, reason: "founder has no company" };

  const { submitSupportRequest } = await import("@/lib/support/submit");
  const result = await submitSupportRequest(db() as unknown as SupabaseClient<Database>, {
    companyId,
    founderId: founder.id,
    subject: (input.subject ?? "").replace(/^(re|fwd?):\s*/i, "").trim().slice(0, 160) || "Email to support",
    body: plainFromEmail(input.text, input.html) || "(no message body)",
    source: "email",
    contextStage: null,
    contextItem: null,
    via: "form",
  });
  return "error" in result ? { matched: false, reason: result.error } : { matched: true, requestId: result.id };
}
