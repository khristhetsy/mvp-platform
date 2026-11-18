/**
 * Where one founder's introductions stand.
 *
 * Pure, so the numbers in the email can be tested without a database.
 */

export type StatusInput = {
  id: string;
  founderRegId: string;
  investorRegId: string;
  status: string;
  /** Set by the founder once they pick a slot. */
  scheduledAt: string | null;
};

export type FounderStatus = {
  founderRegId: string;
  introduced: number;
  /** Introduced, no answer yet. */
  awaiting: number;
  /** Said "not right now". Counted, never named. */
  declined: number;
  /** Accepted and waiting on the founder to choose a time. */
  needsTime: StatusInput[];
  /** Accepted with a time chosen. */
  scheduled: StatusInput[];
};

export function summarizeByFounder(rows: StatusInput[]): Map<string, FounderStatus> {
  const out = new Map<string, FounderStatus>();
  for (const r of rows) {
    const s = out.get(r.founderRegId) ?? {
      founderRegId: r.founderRegId, introduced: 0, awaiting: 0, declined: 0, needsTime: [], scheduled: [],
    };
    s.introduced += 1;
    if (r.status === "declined") s.declined += 1;
    else if (r.status === "accepted") (r.scheduledAt ? s.scheduled : s.needsTime).push(r);
    else s.awaiting += 1;
    out.set(r.founderRegId, s);
  }
  return out;
}

/** Everyone who said yes, with or without a time. */
export const acceptedCount = (s: FounderStatus) => s.needsTime.length + s.scheduled.length;

/** One presenter's row in the admin panel. */
export type FounderPanelRow = {
  name: string;
  introduced: number;
  accepted: number;
  awaiting: number;
  declined: number;
  /** Accepted investors the presenter has booked a time with. */
  timeSet: number;
  /** When staff last emailed this presenter their status. Null: never. */
  lastEmailedAt: string | null;
};

/** Fixed zone and locale, so the server and the browser print the same text. */
export function formatEmailedAt(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never";
  return `${d.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} UTC`;
}
