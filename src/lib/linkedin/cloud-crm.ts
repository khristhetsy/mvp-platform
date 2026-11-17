// Connects CRM contacts to the cloud sender: pick an audience, send the ready ones as leads
// (each carrying its CRM contact id), and write accepted and replied back to the Notes log.
// Reuses the audience rules (do not contact, no link, already connected) from ./audience.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { logCommunication } from "@/lib/notes-log";
import { classifyContact, type AudienceContact, type Classified } from "./audience";
import { addLeads, isUuid, listLeads, type CloudLead, type CloudSenderConfig } from "./cloud-sender";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type AudienceFilters = { module?: "investor" | "founder"; stage?: string; tag?: string; industry?: string };

export type CloudAudienceSummary = {
  total: number;
  ready: number;
  noLink: number;
  doNotContact: number;
  alreadyConnected: number;
  alreadyInCampaign: number;
};

const CONTACT_COLS = "id, name, email, linkedin_slug, source, tags, raw";
export const AUDIENCE_MAX = 2000;

type Contact = AudienceContact;

async function loadContacts(f: AudienceFilters): Promise<Contact[]> {
  let q = db().from("crm_contacts").select(CONTACT_COLS).limit(AUDIENCE_MAX);
  if (f.module) q = q.eq("module", f.module);
  if (f.stage) q = q.eq("stage", f.stage);
  if (f.tag) q = q.contains("tags", [f.tag]);
  if (f.industry) q = q.filter("profile->industries", "cs", JSON.stringify([f.industry]));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Contact[];
}

async function unsubscribedEmails(emails: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  for (let i = 0; i < clean.length; i += 500) {
    const { data } = await db().from("marketing_unsubscribes").select("email").in("email", clean.slice(i, i + 500));
    for (const r of (data ?? []) as Array<{ email: string }>) out.add(r.email.toLowerCase());
  }
  return out;
}

/** Pure: count the classified rows into the numbers shown on the page. */
export function summariseCloud(rows: Classified[]): CloudAudienceSummary {
  const s: CloudAudienceSummary = { total: rows.length, ready: 0, noLink: 0, doNotContact: 0, alreadyConnected: 0, alreadyInCampaign: 0 };
  for (const r of rows) {
    if (r.skip === "no_linkedin_link") s.noLink += 1;
    else if (r.skip === "do_not_contact") s.doNotContact += 1;
    else if (r.skip === "in_other_outreach") s.alreadyInCampaign += 1;
    else if (r.route === "message") s.alreadyConnected += 1;
    else if (r.route === "invite") s.ready += 1;
  }
  return s;
}

/** The profile link the sender takes. The slug is stored decoded and lower case, so encode it again. */
export function profileUrl(slug: string): string {
  return `https://www.linkedin.com/in/${encodeURIComponent(slug)}/`;
}

async function classify(f: AudienceFilters, inCampaign: ReadonlySet<string>): Promise<{ contacts: Contact[]; rows: Classified[] }> {
  const contacts = await loadContacts(f);
  const unsub = await unsubscribedEmails(contacts.map((c) => c.email ?? ""));
  // The cloud sender only sends invites, so nobody goes to the email first or the by hand route.
  const rows = contacts.map((c) => classifyContact(c, { unsubscribedEmails: unsub, inOtherOutreach: inCampaign, highValueTag: null, emailFirst: false }));
  return { contacts, rows };
}

async function contactIdsInCampaign(cfg: CloudSenderConfig, campaignId: string): Promise<Set<string>> {
  const leads = await listLeads(cfg, campaignId);
  return new Set(leads.map((l) => l.external_ref).filter((r): r is string => !!r));
}

export async function previewCloudAudience(cfg: CloudSenderConfig, campaignId: string, f: AudienceFilters): Promise<CloudAudienceSummary> {
  const { rows } = await classify(f, await contactIdsInCampaign(cfg, campaignId));
  return summariseCloud(rows);
}

/** Send every ready contact to the campaign as a lead. Only contacts classified "invite" go. */
export async function addCloudAudience(cfg: CloudSenderConfig, campaignId: string, f: AudienceFilters): Promise<{ summary: CloudAudienceSummary; added: number; skipped: number }> {
  const { contacts, rows } = await classify(f, await contactIdsInCampaign(cfg, campaignId));
  const byId = new Map(contacts.map((c) => [c.id, c] as const));
  const leads = rows.flatMap((r) => {
    if (r.skip || r.route !== "invite") return [];
    const c = byId.get(r.contactId);
    return [{ url: profileUrl(r.slug), externalRef: r.contactId, fullName: c?.name ?? undefined }];
  });
  let added = 0;
  let skipped = 0;
  for (let i = 0; i < leads.length; i += 200) {
    const r = await addLeads(cfg, campaignId, leads.slice(i, i + 200));
    added += r.added;
    skipped += r.skipped.length;
  }
  return { summary: summariseCloud(rows), added, skipped };
}

export type SyncCounts = { logged: number; duplicate: number; failed: number };

/** One Notes log line per accepted or replied lead that came from the CRM. The same line is never written twice. */
export function notesFor(l: Pick<CloudLead, "id" | "external_ref" | "accepted_at" | "replied_at">): Array<{ contactId: string; summary: string; at: string; externalId: string; inbound: boolean }> {
  if (!l.external_ref || !isUuid(l.external_ref)) return [];
  const out = [];
  if (l.accepted_at) out.push({ contactId: l.external_ref, summary: "LinkedIn: invite accepted", at: l.accepted_at, externalId: `cloud-sender:${l.id}:accepted`, inbound: false });
  if (l.replied_at) out.push({ contactId: l.external_ref, summary: "LinkedIn: replied", at: l.replied_at, externalId: `cloud-sender:${l.id}:replied`, inbound: true });
  return out;
}

export async function syncToCrm(cfg: CloudSenderConfig, campaignId: string, campaignName?: string): Promise<SyncCounts> {
  const leads = await listLeads(cfg, campaignId);
  const counts: SyncCounts = { logged: 0, duplicate: 0, failed: 0 };
  for (const l of leads) {
    for (const n of notesFor(l)) {
      const res = await logCommunication({
        kind: "message",
        summary: n.summary,
        contactCrmId: n.contactId,
        occurredAt: n.at,
        meta: { external_id: n.externalId, campaign_name: campaignName, direction: n.inbound ? "inbound" : "outbound" },
      });
      counts[res] += 1;
    }
  }
  return counts;
}
