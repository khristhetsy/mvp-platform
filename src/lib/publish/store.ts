// Prospect Pipeline — Step 5: publish store. Create (with lint), batch
// eligibility (thirds), the ≥97% deliverability gate, and the firewall send.
//
// FIREWALL: approveAndSend is the ONLY path that fires Resend, and it requires an
// authenticated admin (the human click from an admin route). It refuses to send a
// lint_flagged item and refuses batch N+1 until batch N clears 97% deliverability.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { sendMarketingEmail, makeUnsubscribeToken } from "@/lib/marketing/send";
import { isUnsubscribed } from "@/lib/marketing/contacts";
import { advanceLeadStatus } from "@/lib/prospects/lead-status";
import { lintCopy, type LintResult, type PublishBody } from "./lint";

const MAX_PER_APPROVE = 250;
const DELIVERABILITY_THRESHOLD = 0.97;
const DEFAULT_FROM_NAME = "iCapOS";
const DEFAULT_FROM_EMAIL = "outreach@mail.icapos.com";

export type Segment = "hot" | "warm" | "cold";

export interface CreatePublishInput {
  channel: "email";
  title: string;
  subject: string;
  html: string;
  text?: string | null;
  segment: Segment;
  wave?: string | null;
  batch?: number | null;
}

export interface PublishItem {
  id: string;
  channel: string;
  title: string;
  body: PublishBody;
  segment: string | null;
  wave: string | null;
  batch: number | null;
  status: string;
  lint_result: LintResult | Record<string, unknown>;
  sent_at: string | null;
  created_at: string;
}

/** Create an item, run lint, and set status = ready | lint_flagged. */
export async function createPublishItem(input: CreatePublishInput, adminId: string): Promise<PublishItem> {
  const db = serviceRoleClientUntyped();
  const body: PublishBody = { subject: input.subject, html: input.html, text: input.text ?? null };
  const lint = lintCopy(input.title, body);
  const status = lint.ok ? "ready" : "lint_flagged";

  const { data, error } = await db
    .from("publish_items")
    .insert({
      channel: input.channel,
      title: input.title,
      body,
      segment: input.segment,
      wave: input.wave ?? "1",
      batch: input.batch ?? 1,
      status,
      lint_result: lint,
      created_by: adminId,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PublishItem;
}

export async function listPublishItems(): Promise<PublishItem[]> {
  const db = serviceRoleClientUntyped();
  const { data } = await db.from("publish_items").select("*").order("created_at", { ascending: false }).limit(100);
  return (data ?? []) as PublishItem[];
}

type ContactRow = { id: string; email: string | null; name: string | null; company: string | null; email_status: string | null };

/** Eligible contacts for a segment, split into thirds; returns the Nth batch. */
async function batchEligibleContacts(segment: string, batch: number): Promise<ContactRow[]> {
  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("crm_contacts")
    .select("id, email, name, company, email_status")
    .eq("segment", segment)
    .eq("suppressed", false)
    .eq("converted", false)
    .not("email", "is", null)
    .in("email_status", ["valid", "unverified"]) // risky/invalid held from sends
    .order("lead_prescore", { ascending: false, nullsFirst: false });
  const all = (data ?? []) as ContactRow[];
  const third = Math.ceil(all.length / 3);
  const b = Math.min(Math.max(batch, 1), 3);
  return all.slice((b - 1) * third, b * third);
}

/** Deliverability of a prior batch = (sent - bounced) / sent, from publish_events. */
async function batchDeliverability(segment: string, wave: string, batch: number): Promise<{ sent: number; bounced: number; rate: number } | null> {
  const db = serviceRoleClientUntyped();
  const { data: items } = await db
    .from("publish_items")
    .select("id")
    .eq("segment", segment)
    .eq("wave", wave)
    .eq("batch", batch)
    .eq("status", "sent");
  const ids = (items ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return null; // prior batch not sent yet
  const [{ count: sent }, { count: bounced }] = await Promise.all([
    db.from("publish_events").select("id", { count: "exact", head: true }).in("publish_id", ids).eq("event", "sent"),
    db.from("publish_events").select("id", { count: "exact", head: true }).in("publish_id", ids).eq("event", "bounce"),
  ]);
  const s = sent ?? 0;
  const b = bounced ?? 0;
  return { sent: s, bounced: b, rate: s > 0 ? (s - b) / s : 1 };
}

export interface SendResultSummary {
  sent: number;
  skipped: number;
  failed: number;
  remaining: number;
  complete: boolean;
}

/**
 * THE FIREWALL. Human-approved send of a ready item's batch via Resend. Blocks
 * lint_flagged items and unmet deliverability gates.
 */
export async function approveAndSend(itemId: string, adminId: string): Promise<SendResultSummary> {
  const db = serviceRoleClientUntyped();
  const { data: item } = await db.from("publish_items").select("*").eq("id", itemId).single();
  if (!item) throw new Error("Publish item not found.");

  if (item.status === "lint_flagged") {
    throw new Error("Blocked: this copy failed the compliance lint and cannot be sent. Fix the flags and recreate.");
  }
  if (item.status === "sent") throw new Error("This item was already fully sent.");
  if (item.channel !== "email") throw new Error("Only the email channel can send today.");
  if (!item.segment) throw new Error("Item has no segment audience.");

  const batch: number = item.batch ?? 1;
  const wave: string = item.wave ?? "1";

  // Wave gate: batch N+1 blocked until batch N ≥ 97% deliverability.
  if (batch > 1) {
    const prior = await batchDeliverability(item.segment, wave, batch - 1);
    if (!prior) throw new Error(`Blocked: batch ${batch - 1} of this wave hasn't been sent yet.`);
    if (prior.rate < DELIVERABILITY_THRESHOLD) {
      throw new Error(`Blocked: batch ${batch - 1} deliverability is ${(prior.rate * 100).toFixed(1)}% (need ≥ 97%).`);
    }
  }

  // Contacts already sent this exact item (so repeated approvals drain the batch).
  const { data: already } = await db.from("publish_events").select("contact_id").eq("publish_id", itemId).eq("event", "sent");
  const sentSet = new Set((already ?? []).map((r: { contact_id: string }) => r.contact_id));

  const eligible = await batchEligibleContacts(item.segment, batch);
  const pending = eligible.filter((c) => !sentSet.has(c.id));
  const slice = pending.slice(0, MAX_PER_APPROVE);

  const body = (item.body ?? {}) as PublishBody;
  let sent = 0, skipped = 0, failed = 0;

  for (const c of slice) {
    if (!c.email) { skipped++; continue; }
    if (await isUnsubscribed(c.email)) { skipped++; continue; }
    const res = await sendMarketingEmail({
      to: c.email,
      first_name: (c.name ?? "").split(/\s+/)[0] || null,
      company: c.company,
      from_name: DEFAULT_FROM_NAME,
      from_email: DEFAULT_FROM_EMAIL,
      reply_to: null,
      subject: body.subject ?? item.title,
      html_body: body.html ?? "",
      text_body: body.text ?? null,
      unsubscribe_token: makeUnsubscribeToken(c.email),
    });
    await db.from("publish_events").insert({
      contact_id: c.id,
      publish_id: itemId,
      email: c.email,
      resend_id: res.resend_id,
      event: res.ok ? "sent" : "bounce",
    });
    if (res.ok) {
      sent++;
      // Activity nudge: a delivered send moves a new lead → contacted.
      await advanceLeadStatus(db, c.id, "contacted");
    } else failed++;
    await new Promise((r) => setTimeout(r, 120));
  }

  const remaining = pending.length - slice.length;
  const complete = remaining === 0;

  await db
    .from("publish_items")
    .update({
      status: complete ? "sent" : "ready",
      approved_by: adminId,
      sent_at: complete ? new Date().toISOString() : item.sent_at,
    })
    .eq("id", itemId);

  return { sent, skipped, failed, remaining, complete };
}
