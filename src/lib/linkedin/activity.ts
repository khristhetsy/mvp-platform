// The LinkedIn Activity log: one row per action on a person, read from the events the sender and
// the campaign code already record (linkedin_events). Nothing new is stored.
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export const ACTIVITY_PAGE_SIZE = 25;
export const ACTIVITY_EXPORT_MAX = 2000;

/** Events that describe something done to one person. Campaign level events are left out. */
export const PERSON_KINDS = ["queued", "invite_sent", "accepted", "message_sent", "reply", "handed_off", "warning", "withdrawn", "failed"] as const;

export type ActivityStatus = "sent" | "dry_run" | "failed" | "already_connected" | "accepted" | "message_sent" | "replied" | "handed_off" | "withdrawn" | "warning" | "queued";
export const ACTIVITY_STATUSES: Array<{ id: ActivityStatus; label: string }> = [
  { id: "sent", label: "Sent" },
  { id: "dry_run", label: "Dry run" },
  { id: "failed", label: "Failed" },
  { id: "already_connected", label: "Already connected" },
  { id: "accepted", label: "Accepted" },
  { id: "message_sent", label: "Message sent" },
  { id: "replied", label: "Replied" },
  { id: "handed_off", label: "Handed off" },
  { id: "withdrawn", label: "Withdrawn" },
  { id: "warning", label: "Warning" },
  { id: "queued", label: "Queued" },
];

const DRY_RUN_PREFIX = "Dry run";
const ALREADY_PREFIX = "Already connected";

/** The status shown for an event. Dry runs and already connected people are stored as "queued" with a detail. */
export function activityStatus(kind: string, detail: string | null): ActivityStatus {
  switch (kind) {
    case "invite_sent": return "sent";
    case "failed": return "failed";
    case "accepted": return "accepted";
    case "message_sent": return "message_sent";
    case "reply": return "replied";
    case "handed_off": return "handed_off";
    case "withdrawn": return "withdrawn";
    case "warning": return "warning";
    default:
      if ((detail ?? "").startsWith(DRY_RUN_PREFIX)) return "dry_run";
      if ((detail ?? "").startsWith(ALREADY_PREFIX)) return "already_connected";
      return "queued";
  }
}

export function activityLabel(status: ActivityStatus): string {
  return ACTIVITY_STATUSES.find((s) => s.id === status)?.label ?? status;
}

/** Message events are messages, everything else is about the invite. */
export function activityAction(kind: string): "Invite" | "Message" {
  return kind === "message_sent" || kind === "reply" || kind === "handed_off" ? "Message" : "Invite";
}

/** The short reason shown beside the status. The dry run prefix is dropped because the status says it. */
export function activityReason(status: ActivityStatus, detail: string | null): string {
  const d = (detail ?? "").trim();
  if (status === "dry_run") return d.replace(/^Dry run:\s*/i, "").replace(/^./, (c) => c.toUpperCase());
  return d;
}

/** Only a clean slug becomes a link. Anything else is shown as plain text. */
export function linkedInProfileUrl(slug: string | null | undefined): string | null {
  const s = (slug ?? "").trim();
  if (!s || !/^[^\s/?#]+$/.test(s)) return null;
  try { return `https://www.linkedin.com/in/${encodeURIComponent(decodeURIComponent(s))}/`; } catch { return null; }
}

export type ActivityRow = {
  id: string; at: string; person: string; personUrl: string | null; contactId: string | null;
  account: string; accountUrl: string | null; campaign: string | null;
  action: "Invite" | "Message"; status: ActivityStatus; reason: string;
};

export type ActivityFilters = { status?: ActivityStatus; campaignId?: string; q?: string; page?: number; limit?: number };

type EventRow = {
  id: string; kind: string; detail: string | null; created_at: string;
  linkedin_targets: { display_name: string | null; linkedin_slug: string | null; contact_id: string | null } | null;
  linkedin_campaigns: { name: string } | null;
  linkedin_accounts: { label: string; linkedin_slug: string | null } | null;
};

export function toActivityRow(e: EventRow): ActivityRow {
  const status = activityStatus(e.kind, e.detail);
  return {
    id: e.id, at: e.created_at,
    person: e.linkedin_targets?.display_name?.trim() || "Unknown",
    personUrl: linkedInProfileUrl(e.linkedin_targets?.linkedin_slug),
    contactId: e.linkedin_targets?.contact_id ?? null,
    account: e.linkedin_accounts?.label ?? "",
    accountUrl: linkedInProfileUrl(e.linkedin_accounts?.linkedin_slug),
    campaign: e.linkedin_campaigns?.name ?? null,
    action: activityAction(e.kind), status, reason: activityReason(status, e.detail),
  };
}

/** The page of activity for one account, newest first. */
export async function listActivity(accountId: string, f: ActivityFilters = {}): Promise<{ rows: ActivityRow[]; total: number }> {
  const limit = Math.min(Math.max(f.limit ?? ACTIVITY_PAGE_SIZE, 1), ACTIVITY_EXPORT_MAX);
  const page = Math.max(f.page ?? 1, 1);
  const q = (f.q ?? "").trim().replace(/[%,()]/g, " ").slice(0, 60);
  const targets = q ? "linkedin_targets!inner(display_name, linkedin_slug, contact_id)" : "linkedin_targets(display_name, linkedin_slug, contact_id)";
  let query = db().from("linkedin_events")
    .select(`id, kind, detail, created_at, ${targets}, linkedin_campaigns(name), linkedin_accounts(label, linkedin_slug)`, { count: "exact" })
    .eq("account_id", accountId).not("target_id", "is", null).in("kind", [...PERSON_KINDS]);
  if (f.campaignId) query = query.eq("campaign_id", f.campaignId);
  if (q) query = query.ilike("linkedin_targets.display_name", `%${q}%`);
  if (f.status) {
    const s = f.status;
    if (s === "dry_run") query = query.eq("kind", "queued").ilike("detail", `${DRY_RUN_PREFIX}%`);
    else if (s === "already_connected") query = query.eq("kind", "queued").ilike("detail", `${ALREADY_PREFIX}%`);
    else if (s === "queued") query = query.eq("kind", "queued").not("detail", "ilike", `${DRY_RUN_PREFIX}%`).not("detail", "ilike", `${ALREADY_PREFIX}%`);
    else {
      const kind = ({ sent: "invite_sent", failed: "failed", accepted: "accepted", message_sent: "message_sent", replied: "reply", handed_off: "handed_off", withdrawn: "withdrawn", warning: "warning" } as Record<string, string>)[s];
      if (kind) query = query.eq("kind", kind);
    }
  }
  const from = (page - 1) * limit;
  const res = await query.order("created_at", { ascending: false }).range(from, from + limit - 1);
  if (res.error) throw new Error(res.error.message);
  return { rows: ((res.data ?? []) as EventRow[]).map(toActivityRow), total: res.count ?? 0 };
}

function csvCell(v: string): string {
  // A cell that starts with = + - @ can run as a formula in a spreadsheet, so it is neutralised.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function activityCsv(rows: ActivityRow[], timeZone: string): string {
  const fmt = (iso: string) => {
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
      return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
    } catch { return iso; }
  };
  const head = ["When", "Person", "LinkedIn profile", "Account", "Campaign", "Action", "Status", "Reason"];
  const lines = rows.map((r) => [fmt(r.at), r.person, r.personUrl ?? "", r.account, r.campaign ?? "", r.action, activityLabel(r.status), r.reason].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\n");
}
