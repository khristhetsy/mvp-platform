/**
 * Pilot results for the AI IR Coach. Aggregates only: counts, never names, never message text.
 *
 * Honest by construction:
 *  - Coached founders are everyone ever enrolled (a founder who later paused or ended still counts,
 *    so dropping out cannot flatter the result).
 *  - The comparison group is eligible founders who were never enrolled.
 *  - The measures are actions both groups can take on the platform with or without the coach
 *    (contacts added to manual outreach, contacts sent). Replies are shown as a count only.
 *  - With a small, hand picked group this can show a direction, never proof. The page says so.
 */
import { isInternalAccount } from "@/lib/notifications/internal-accounts";

const DAY_MS = 86_400_000;
export const PILOT_WEEKS = 8;
/** Below this many founders in either group a comparison tells you almost nothing. */
export const MIN_GROUP = 5;

export type PilotFounder = { id: string; email: string | null };
export type PilotEnrollment = { founder_id: string; status: string; source: string; started_at: string };
export type PilotRecipient = { company_id: string; enrolled_at: string | null; last_sent_at: string | null; replied_at: string | null };

export type PilotGroup = {
  founders: number;
  /** Founders with at least one contact sent since the pilot began. */
  foundersWhoSent: number;
  contactsAdded: number;
  contactsSent: number;
  replies: number;
  medianSentPerFounder: number;
};

export type PilotReadout = {
  /** No pilot yet: nobody has been enrolled. */
  started: boolean;
  startedAt: string | null;
  weeksElapsed: number;
  weeksTotal: number;
  eligible: number;
  coached: PilotGroup;
  comparison: PilotGroup;
  /** Which way people got into the pilot, so the reader can judge how fair the comparison is. */
  selection: { handPicked: number; optedIn: number; allFounders: number };
  /** Plain sentences for the page. Never a significance claim. */
  notes: string[];
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Only external founders with a company can be coached, so only they can be compared. */
export function eligibleFounders<T extends PilotFounder>(founders: T[], companyByFounder: Map<string, unknown>): T[] {
  return founders.filter((f) => companyByFounder.has(f.id) && !isInternalAccount({ email: f.email, role: "founder" }));
}

/** How to split the eligible founders: an even random split is the fairest comparison available. */
export function pilotSizing(eligible: number): { coached: number; comparison: number; canCompare: boolean; line: string } {
  const coached = Math.floor(eligible / 2);
  const comparison = eligible - coached;
  const canCompare = coached >= MIN_GROUP && comparison >= MIN_GROUP;
  const line = canCompare
    ? `${eligible} founders are eligible. Splitting them at random gives ${coached} coached and ${comparison} not coached, enough to see a direction but not to prove an effect.`
    : `${eligible} founders are eligible, which is too few to split into two groups of ${MIN_GROUP} or more. You can still run the pilot and read it as a case study.`;
  return { coached, comparison, canCompare, line };
}

export function buildPilot(input: {
  founders: PilotFounder[];
  companyByFounder: Map<string, { id: string }>;
  enrollments: PilotEnrollment[];
  recipients: PilotRecipient[];
  now: Date;
}): PilotReadout {
  const eligible = eligibleFounders(input.founders, input.companyByFounder);
  const eligibleIds = new Set(eligible.map((f) => f.id));
  const enrolledEver = input.enrollments.filter((e) => eligibleIds.has(e.founder_id));
  const coachedIds = new Set(enrolledEver.map((e) => e.founder_id));

  const starts = enrolledEver.map((e) => Date.parse(e.started_at)).filter((t) => Number.isFinite(t));
  const startMs = starts.length ? Math.min(...starts) : null;
  const nowMs = input.now.getTime();
  const weeksElapsed = startMs === null ? 0 : Math.max(0, Math.floor((nowMs - startMs) / (7 * DAY_MS)));

  const companyToFounder = new Map<string, string>();
  for (const f of eligible) {
    const c = input.companyByFounder.get(f.id);
    if (c) companyToFounder.set(c.id, f.id);
  }
  const perFounder = new Map<string, { added: number; sent: number; replies: number }>();
  const slot = (id: string) => {
    let v = perFounder.get(id);
    if (!v) perFounder.set(id, (v = { added: 0, sent: 0, replies: 0 }));
    return v;
  };
  if (startMs !== null) {
    for (const r of input.recipients) {
      const fid = companyToFounder.get(r.company_id);
      if (!fid) continue;
      const after = (iso: string | null) => iso !== null && Date.parse(iso) >= startMs;
      if (after(r.enrolled_at)) slot(fid).added += 1;
      if (after(r.last_sent_at)) slot(fid).sent += 1;
      if (after(r.replied_at)) slot(fid).replies += 1;
    }
  }

  const summarize = (ids: string[]): PilotGroup => {
    const rows = ids.map((id) => perFounder.get(id) ?? { added: 0, sent: 0, replies: 0 });
    return {
      founders: ids.length,
      foundersWhoSent: rows.filter((r) => r.sent > 0).length,
      contactsAdded: rows.reduce((n, r) => n + r.added, 0),
      contactsSent: rows.reduce((n, r) => n + r.sent, 0),
      replies: rows.reduce((n, r) => n + r.replies, 0),
      medianSentPerFounder: median(rows.map((r) => r.sent)),
    };
  };
  const coached = summarize([...coachedIds]);
  const comparison = summarize(eligible.filter((f) => !coachedIds.has(f.id)).map((f) => f.id));

  const selection = {
    handPicked: enrolledEver.filter((e) => e.source === "admin_selected").length,
    optedIn: enrolledEver.filter((e) => e.source === "founder_opt_in").length,
    allFounders: enrolledEver.filter((e) => e.source === "admin_all").length,
  };

  const notes: string[] = [];
  if (startMs === null) {
    notes.push("No founder has been enrolled yet, so there is nothing to read.");
  } else {
    if (weeksElapsed < PILOT_WEEKS) notes.push(`${weeksElapsed} of ${PILOT_WEEKS} weeks in. Wait for the full ${PILOT_WEEKS} weeks before drawing a conclusion.`);
    if (coached.founders < MIN_GROUP || comparison.founders < MIN_GROUP) {
      notes.push(`One group has fewer than ${MIN_GROUP} founders, so these counts show what happened, not what the coach caused.`);
    }
    if (selection.handPicked > 0 || selection.optedIn > 0) {
      notes.push(
        "Founders were chosen by hand or opted in, so they may already have been the more active ones. Differences can come from who was picked, not from the coach.",
      );
    }
    notes.push("Contacts sent counts each contact once, at the latest send, so it understates volume for both groups the same way.");
  }

  return {
    started: startMs !== null,
    startedAt: startMs === null ? null : new Date(startMs).toISOString(),
    weeksElapsed,
    weeksTotal: PILOT_WEEKS,
    eligible: eligible.length,
    coached,
    comparison,
    selection,
    notes,
  };
}
