/**
 * Outreach, counted.
 *
 * The Deploy analytics tab showed four totals — universe, surfaced, reached
 * out, strong fit — and nothing about what happened next, even though every
 * open, click and reply is already recorded per recipient. This turns those
 * rows into a funnel, segments, a series and the follow-up debt.
 *
 * All pure. A period boundary or a reply-rate denominator is exactly the kind
 * of thing that is wrong for months without anybody noticing, so none of it
 * touches a database.
 */

export type OutreachRecord = {
  /** Stable id, for de-duplication and drill-down. */
  id: string;
  investorName: string;
  investorType: string | null;
  sectors: string[];
  geography: string | null;
  subject: string | null;
  /** Null until it actually went out. */
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  /** Whether a human has been in touch since the last event. */
  followedUpAt: string | null;
  /** Manual or automated — both land in the same funnel. */
  channel: "manual" | "automated";
};

export type Period = "day" | "week" | "quarter" | "year";
export type Comparison = "prev" | "year" | "none";

export type Range = { start: Date; end: Date; label: string };

const DAY = 86_400_000;

const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  // Monday first — a founder's week starts when they start sending.
  const shift = (s.getUTCDay() + 6) % 7;
  return new Date(s.getTime() - shift * DAY);
}

const startOfQuarter = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1));

const startOfYear = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The window a period covers, ending now. */
export function rangeFor(period: Period, now: Date = new Date()): Range {
  switch (period) {
    case "day": {
      const start = startOfDay(now);
      return { start, end: new Date(start.getTime() + DAY), label: `${start.getUTCDate()} ${MONTH[start.getUTCMonth()]}` };
    }
    case "week": {
      const start = startOfWeek(now);
      const end = new Date(start.getTime() + 7 * DAY);
      return {
        start, end,
        label: `${start.getUTCDate()} ${MONTH[start.getUTCMonth()]} – ${new Date(end.getTime() - DAY).getUTCDate()} ${MONTH[new Date(end.getTime() - DAY).getUTCMonth()]}`,
      };
    }
    case "quarter": {
      const start = startOfQuarter(now);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
      return { start, end, label: `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${start.getUTCFullYear()}` };
    }
    default: {
      const start = startOfYear(now);
      return { start, end: new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1)), label: String(start.getUTCFullYear()) };
    }
  }
}

/**
 * The window a comparison points at.
 *
 * Returns null for "none", and for a same-period-last-year on a period that
 * has no last year to speak of — the caller shows nothing rather than a rise
 * from zero, which reads as growth.
 */
export function comparisonRange(period: Period, cmp: Comparison, now: Date = new Date()): Range | null {
  if (cmp === "none") return null;
  const cur = rangeFor(period, now);

  if (cmp === "year") {
    const start = new Date(cur.start); start.setUTCFullYear(start.getUTCFullYear() - 1);
    const end = new Date(cur.end); end.setUTCFullYear(end.getUTCFullYear() - 1);
    return { start, end, label: `${cur.label} last year` };
  }

  const span = cur.end.getTime() - cur.start.getTime();
  const start = period === "quarter"
    ? new Date(Date.UTC(cur.start.getUTCFullYear(), cur.start.getUTCMonth() - 3, 1))
    : period === "year"
      ? new Date(Date.UTC(cur.start.getUTCFullYear() - 1, 0, 1))
      : new Date(cur.start.getTime() - span);
  const end = period === "quarter" || period === "year" ? cur.start : new Date(cur.start.getTime());
  return { start, end, label: "previous period" };
}

const within = (iso: string | null, r: Range): boolean => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= r.start.getTime() && t < r.end.getTime();
};

/** Everything sent inside the window. Sent is the anchor: an open in March of a
 *  February email belongs to February's send. */
export function inRange(records: OutreachRecord[], r: Range | null): OutreachRecord[] {
  if (!r) return [];
  return records.filter((rec) => within(rec.sentAt, r));
}

export type FunnelStep = {
  key: "sent" | "opened" | "clicked" | "replied";
  label: string;
  count: number;
  /** Share of sends, 0–100. */
  ofSent: number;
  records: OutreachRecord[];
};

/**
 * Sent → opened → clicked → replied.
 *
 * Each step is a subset of the one above by construction, so a reply that
 * never recorded an open still counts as opened — the provider missing an
 * event is not the founder's doing.
 */
export function funnel(records: OutreachRecord[]): FunnelStep[] {
  const sent = records.filter((r) => r.sentAt);
  const replied = sent.filter((r) => r.repliedAt);
  const clicked = sent.filter((r) => r.clickedAt || r.repliedAt);
  const opened = sent.filter((r) => r.openedAt || r.clickedAt || r.repliedAt);

  const pct = (n: number) => (sent.length ? Math.round((n / sent.length) * 100) : 0);
  return [
    { key: "sent", label: "Reached out", count: sent.length, ofSent: sent.length ? 100 : 0, records: sent },
    { key: "opened", label: "Opened", count: opened.length, ofSent: pct(opened.length), records: opened },
    { key: "clicked", label: "Clicked", count: clicked.length, ofSent: pct(clicked.length), records: clicked },
    { key: "replied", label: "Replied", count: replied.length, ofSent: pct(replied.length), records: replied },
  ];
}

export type Segment = { label: string; sent: number; replied: number; rate: number };

/**
 * Reply rate by investor type, sector or geography.
 *
 * Segments with too few sends to mean anything are still returned — the caller
 * decides what to show — but `rate` on two sends is noise and is flagged by the
 * `sent` count travelling with it.
 */
export function segments(records: OutreachRecord[], by: "type" | "sector" | "geography"): Segment[] {
  const buckets = new Map<string, { sent: number; replied: number }>();

  for (const r of records) {
    if (!r.sentAt) continue;
    const keys = by === "type"
      ? [r.investorType?.trim() || "Unknown"]
      : by === "geography"
        ? [r.geography?.trim() || "Unknown"]
        : (r.sectors.length ? r.sectors : ["Unknown"]);

    for (const k of keys) {
      const b = buckets.get(k) ?? { sent: 0, replied: 0 };
      b.sent += 1;
      if (r.repliedAt) b.replied += 1;
      buckets.set(k, b);
    }
  }

  return [...buckets]
    .map(([label, b]) => ({ label, ...b, rate: b.sent ? Math.round((b.replied / b.sent) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate || b.sent - a.sent || a.label.localeCompare(b.label));
}

export type Bucket = { key: string; label: string; sent: number; replied: number };

/** The series inside a window: hours for a day, days for a week, months for a
 *  quarter, quarters for a year. */
export function series(records: OutreachRecord[], period: Period, r: Range): Bucket[] {
  const out: Bucket[] = [];
  const add = (key: string, label: string) => out.push({ key, label, sent: 0, replied: 0 });

  if (period === "day") {
    for (let h = 0; h < 24; h += 3) add(String(h), `${((h % 12) || 12)}${h < 12 ? "a" : "p"}`);
  } else if (period === "week") {
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let d = 0; d < 7; d += 1) add(String(d), names[d]);
  } else if (period === "quarter") {
    for (let m = 0; m < 3; m += 1) {
      const month = (r.start.getUTCMonth() + m) % 12;
      add(String(month), MONTH[month]);
    }
  } else {
    for (let q = 0; q < 4; q += 1) add(String(q), `Q${q + 1}`);
  }

  const index = (iso: string): number => {
    const d = new Date(iso);
    if (period === "day") return Math.floor(d.getUTCHours() / 3);
    if (period === "week") return Math.floor((d.getTime() - r.start.getTime()) / DAY);
    if (period === "quarter") return d.getUTCMonth() - r.start.getUTCMonth();
    return Math.floor(d.getUTCMonth() / 3);
  };

  for (const rec of records) {
    if (!rec.sentAt) continue;
    const i = index(rec.sentAt);
    if (i >= 0 && i < out.length) {
      out[i].sent += 1;
      if (rec.repliedAt) out[i].replied += 1;
    }
  }
  return out;
}

export type MessageRow = { subject: string; sent: number; opened: number; replied: number };

/** Sends, opens and replies per subject line. */
export function messages(records: OutreachRecord[]): MessageRow[] {
  const rows = new Map<string, MessageRow>();
  for (const r of records) {
    if (!r.sentAt) continue;
    const subject = r.subject?.trim() || "(no subject recorded)";
    const row = rows.get(subject) ?? { subject, sent: 0, opened: 0, replied: 0 };
    row.sent += 1;
    if (r.openedAt || r.clickedAt || r.repliedAt) row.opened += 1;
    if (r.repliedAt) row.replied += 1;
    rows.set(subject, row);
  }
  return [...rows.values()].sort((a, b) => b.replied - a.replied || b.sent - a.sent);
}

/**
 * Opened, never answered, never chased.
 *
 * The most valuable list on the page: somebody read it and nothing happened
 * since. A reply takes them off — they are no longer owed a nudge.
 */
export function followUpDebt(
  records: OutreachRecord[],
  opts: { now?: Date; afterDays?: number } = {},
): Array<OutreachRecord & { daysSince: number }> {
  const now = (opts.now ?? new Date()).getTime();
  const after = (opts.afterDays ?? 3) * DAY;

  return records
    .filter((r) => (r.openedAt || r.clickedAt) && !r.repliedAt)
    .map((r) => {
      const last = Math.max(
        new Date(r.openedAt ?? 0).getTime(),
        new Date(r.clickedAt ?? 0).getTime(),
        new Date(r.followedUpAt ?? 0).getTime(),
      );
      return { ...r, daysSince: Math.floor((now - last) / DAY), _last: last };
    })
    .filter((r) => now - r._last >= after)
    .sort((a, b) => b.daysSince - a.daysSince)
    .map(({ _last, ...rest }) => rest);
}

export type Delta = { now: number; was: number | null; pct: number | null; direction: "up" | "down" | "flat" };

/**
 * This period against the comparison.
 *
 * `was: null` when there is nothing to compare — a founder who started sending
 * in July has no "same week last year", and showing that as +100% would be a
 * lie about growth.
 */
export function delta(now: number, was: number | null): Delta {
  if (was === null) return { now, was: null, pct: null, direction: "flat" };
  if (was === 0) {
    return { now, was, pct: now === 0 ? 0 : null, direction: now > 0 ? "up" : "flat" };
  }
  const pct = Math.round(((now - was) / was) * 100);
  return { now, was, pct, direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

/** Too few sends for a rate to mean anything. */
export const MIN_FOR_RATE = 5;

export function rateIsMeaningful(sent: number): boolean {
  return sent >= MIN_FOR_RATE;
}
