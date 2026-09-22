/**
 * Every outreach send this company has made, in one shape.
 *
 * Manual sends live on `founder_manual_outreach_recipients` (with the subject
 * one level up on `founder_manual_outreach`), automated ones on
 * `investor_outreach_recipients` via their campaign, and the CRM's own
 * `outreach_messages` carries a subject per message. The analytics page needs
 * them as one list; this is the only place that knows they are three tables.
 *
 * Opens and clicks have been recorded per recipient since the provider webhook
 * landed, and replies since the inbound one. Nothing has ever totalled them.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { OutreachRecord } from "@/lib/analytics/outreach-metrics";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** `preferred_sectors` is a comma-separated text column, not an array. */
function sectorsOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v !== "string") return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Load the company's outreach history.
 *
 * Never throws: an analytics page that 500s because one table is empty is worse
 * than one that reports nothing yet.
 */
export async function loadOutreachRecords(companyId: string): Promise<OutreachRecord[]> {
  if (!companyId) return [];
  const db = raw();

  try {
    const [manualRes, campaignRes, messageRes, campaignSubjectRes] = await Promise.all([
      db.from("founder_manual_outreach_recipients")
        .select("id, email, name, contact_id, last_sent_at, opened_at, clicked_at, replied_at, updated_at")
        .eq("company_id", companyId),
      db.from("founder_manual_outreach").select("email_subject").eq("company_id", companyId).maybeSingle(),
      db.from("outreach_messages").select("id, contact_id, subject, sent_at, opened_at, replied_at, status"),
      db.from("investor_outreach_campaigns").select("id").eq("company_id", companyId),
    ]);

    const manualSubject = str((campaignRes.data as Row | null)?.email_subject);
    const manualRows = (manualRes.data ?? []) as Row[];

    // One lookup for the segment fields: type, sectors and geography live on
    // the contact, not on the send.
    const contactIds = [
      ...new Set(manualRows.map((r) => str(r.contact_id)).filter((v): v is string => Boolean(v))),
    ];
    const contacts = new Map<string, Row>();
    if (contactIds.length) {
      const { data } = await db
        .from("founder_investor_contacts")
        .select("id, investor_name, investor_type, preferred_sectors, geography")
        .in("id", contactIds);
      for (const c of ((data ?? []) as Row[])) contacts.set(String(c.id), c);
    }

    // The CRM's per-message rows carry the only real subject history, so they
    // win where a contact has both.
    const bySubjectContact = new Map<string, Row>();
    for (const m of ((messageRes.data ?? []) as Row[])) {
      const cid = str(m.contact_id);
      if (cid && contacts.has(cid)) bySubjectContact.set(cid, m);
    }

    const out: OutreachRecord[] = manualRows.map((r) => {
      const contact = contacts.get(str(r.contact_id) ?? "") ?? {};
      const message = bySubjectContact.get(str(r.contact_id) ?? "");
      return {
        id: String(r.id),
        investorName: str(contact.investor_name) ?? str(r.name) ?? str(r.email) ?? "An investor",
        investorType: str(contact.investor_type),
        sectors: sectorsOf(contact.preferred_sectors),
        geography: str(contact.geography),
        subject: str(message?.subject) ?? manualSubject,
        sentAt: str(r.last_sent_at) ?? str(message?.sent_at),
        openedAt: str(r.opened_at) ?? str(message?.opened_at),
        clickedAt: str(r.clicked_at),
        repliedAt: str(r.replied_at) ?? str(message?.replied_at),
        // The manual sequence advances the row when a step goes out, so the
        // last update after an open is the nearest thing to a chase.
        followedUpAt: str(r.updated_at),
        channel: "manual",
      };
    });

    // Automated sends, through this company's campaigns.
    const campaignIds = ((campaignSubjectRes.data ?? []) as Row[]).map((c) => String(c.id));
    if (campaignIds.length) {
      const { data } = await db
        .from("investor_outreach_recipients")
        .select("id, investor_name, email, status, sent_at, opened_at, clicked_at")
        .in("campaign_id", campaignIds);

      for (const r of ((data ?? []) as Row[])) {
        if (String(r.status) === "skipped") continue;
        out.push({
          id: String(r.id),
          investorName: str(r.investor_name) ?? str(r.email) ?? "An investor",
          investorType: null,
          sectors: [],
          geography: null,
          subject: null,
          sentAt: str(r.sent_at),
          openedAt: str(r.opened_at),
          clickedAt: str(r.clicked_at),
          // The automated table has no reply column — the inbound hook only
          // writes to the manual one. Counting these as never-replied would
          // understate the rate, so they carry null and the page says so.
          repliedAt: null,
          followedUpAt: null,
          channel: "automated",
        });
      }
    }

    return out;
  } catch (err) {
    console.error("[outreach-records] load failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Whether any automated send is in the set — the reply rate excludes them. */
export function hasAutomated(records: OutreachRecord[]): boolean {
  return records.some((r) => r.channel === "automated" && r.sentAt);
}
