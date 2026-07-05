// Prospect Pipeline — Lead Status (lifecycle workflow stage).
// The 7-stage lifecycle a prospect moves through as you work them. Distinct from
// email_status (deliverability) and segment (hot/warm/cold engagement tier).
//
// Auto-advance is FORWARD-ONLY and never touches a terminal status: activity can
// nudge a lead up the ladder (a send → contacted, an open/click → engaged), but
// never regress it and never override a human's converted/disqualified call.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "engaged",
  "qualified",
  "nurturing",
  "converted",
  "disqualified",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  engaged: "Engaged",
  qualified: "Qualified",
  nurturing: "Nurturing",
  converted: "Converted",
  disqualified: "Disqualified",
};

// Rank for forward-only auto-advance. qualified/nurturing sit above engaged so an
// open on a qualified lead won't drag it back to engaged. converted/disqualified
// are terminal and excluded from any automatic move.
const RANK: Record<LeadStatus, number> = {
  new: 0,
  contacted: 1,
  engaged: 2,
  qualified: 3,
  nurturing: 3,
  converted: 4,
  disqualified: 4,
};

const TERMINAL: ReadonlySet<string> = new Set(["converted", "disqualified"]);

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}

/**
 * Nudge a contact's lead_status up to `target` from real activity.
 * No-op if the contact is already at/above the target rank or is terminal.
 */
export async function advanceLeadStatus(db: DB, contactId: string, target: LeadStatus): Promise<void> {
  if (!contactId) return;
  const { data } = await db.from("crm_contacts").select("lead_status").eq("id", contactId).maybeSingle();
  const current = (data?.lead_status ?? "new") as LeadStatus;
  if (TERMINAL.has(current)) return;
  if (RANK[target] <= RANK[current]) return;
  await db
    .from("crm_contacts")
    .update({ lead_status: target })
    .eq("id", contactId);
}

/** Set a contact's lead_status explicitly (human override — any transition allowed). */
export async function setLeadStatus(db: DB, contactId: string, status: LeadStatus): Promise<void> {
  await db
    .from("crm_contacts")
    .update({ lead_status: status })
    .eq("id", contactId);
}
