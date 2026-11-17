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
