/**
 * The weekly founder match email. Two versions: through the outreach gate
 * (new matches plus introductions left) and below it (match count, the gate,
 * and the biggest open item). Investors are described by type, check range,
 * fit and reasons only: never a name or contact detail. Names live in the app.
 */
import { button, escapeHtml, shell } from "@/lib/activity/email-templates";

export type DigestMatch = {
  investorType: string | null;
  checkBand: string | null;
  matchScore: number;
  reasons: string[];
};

export type MatchDigestInput = {
  firstName: string | null;
  companyName: string;
  totalMatches: number;
  /** New since the last email, best first. */
  newMatches: DigestMatch[];
  /** No earlier email: every match is new, so the copy introduces them instead. */
  firstEmail: boolean;
  gate:
    | { unlocked: true; weekLeft: number | null; monthLeft: number }
    | { unlocked: false; score: number | null; threshold: number; pointsToGate: number; openItem: string | null };
  matchesUrl: string;
  ratingUrl: string;
};

const MUTED = "#5A6B8C";

/** Refs present now that were not in the last email. */
export function newRefs(current: string[], seen: string[]): string[] {
  const s = new Set(seen);
  return current.filter((r) => !s.has(r));
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function describeMatch(m: DigestMatch): { title: string; reasons: string } {
  const type = m.investorType ? titleCase(m.investorType) : "Investor";
  return {
    title: m.checkBand ? `${type} · Check ${m.checkBand}` : type,
    reasons: m.reasons.slice(0, 2).join(" · "),
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function renderMatchDigestEmail(input: MatchDigestInput): { subject: string; text: string; html: string } {
  const name = input.firstName ? `${input.firstName}, ` : "";
  const newCount = input.newMatches.length;
  const shown = input.newMatches.slice(0, 3);

  const subject =
    input.gate.unlocked && !input.firstEmail && newCount > 0
      ? `${name}${plural(newCount, "new investor", "new investors")} matched ${input.companyName} this week`
      : `${name}${plural(input.totalMatches, "investor matches", "investors match")} ${input.companyName}`;
  const cap = subject.charAt(0).toUpperCase() + subject.slice(1);

  let lead: string;
  if (input.gate.unlocked) {
    lead = input.firstEmail
      ? `You have ${plural(input.totalMatches, "matched investor", "matched investors")}. Here are your strongest.`
      : `You have ${plural(input.totalMatches, "matched investor", "matched investors")} in total. Here are this week's new ones.`;
  } else {
    const newLine = !input.firstEmail && newCount > 0 ? `${newCount} ${newCount === 1 ? "is" : "are"} new this week. ` : "";
    const yours = input.gate.score === null ? "Yours has not been scored yet." : `Yours is ${input.gate.score}.`;
    lead = `${newLine}Introductions open at a Capital Readiness Rating of ${input.gate.threshold}. ${yours}`;
  }

  const allowance = input.gate.unlocked
    ? `Introductions left: ${input.gate.weekLeft !== null ? `${input.gate.weekLeft} this week, ` : ""}${input.gate.monthLeft} this month`
    : null;

  const text = [
    cap,
    "",
    lead,
    "",
    ...(input.gate.unlocked
      ? shown.map((m) => {
          const d = describeMatch(m);
          return `${d.title} (${Math.round(m.matchScore)}% fit)${d.reasons ? `: ${d.reasons}` : ""}`;
        })
      : input.gate.openItem
        ? [`Biggest open item: ${input.gate.openItem}`]
        : []),
    "",
    allowance,
    input.gate.unlocked
      ? `Request introductions: ${input.matchesUrl}`
      : `${input.gate.score === null ? "Run your rating" : `See the ${input.gate.pointsToGate} points`}: ${input.ratingUrl}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  let body: string;
  if (input.gate.unlocked) {
    const cards = shown
      .map((m) => {
        const d = describeMatch(m);
        const fit = Math.round(m.matchScore);
        const badge = fit >= 75 ? "background:#EAF3DE;color:#27500A;" : "background:#E6F1FB;color:#0C447C;";
        return (
          `<table role="presentation" style="width:100%;border:1px solid #E3E8F2;border-radius:8px;border-collapse:separate;margin:0 0 8px;"><tr>` +
          `<td style="padding:10px 12px;"><div style="font-weight:bold;font-size:14px;">${escapeHtml(d.title)}</div>` +
          (d.reasons ? `<div style="font-size:12px;color:${MUTED};">${escapeHtml(d.reasons)}</div>` : "") +
          `</td><td style="padding:10px 12px;text-align:right;white-space:nowrap;"><span style="${badge}font-size:12px;padding:3px 8px;border-radius:6px;">${fit}% fit</span></td>` +
          `</tr></table>`
        );
      })
      .join("");
    body = [
      cards,
      allowance ? `<div style="font-size:13px;color:${MUTED};margin:6px 0 14px;">${escapeHtml(allowance)}</div>` : "",
      `<div>${button("Request introductions", input.matchesUrl, true)}${button(`See all ${input.totalMatches} matches`, input.matchesUrl, false)}</div>`,
    ].join("");
  } else {
    const g = input.gate;
    const pct = g.score === null ? 0 : Math.max(0, Math.min(100, Math.round((g.score / Math.max(g.threshold, 1)) * 100)));
    body = [
      `<div style="height:6px;background:#E3E8F2;border-radius:3px;margin:0 0 14px;"><div style="width:${pct}%;height:6px;background:#1A6CE4;border-radius:3px;"></div></div>`,
      g.openItem
        ? `<div style="font-size:13px;color:${MUTED};">Biggest open item</div><div style="font-size:14px;margin:2px 0 16px;">${escapeHtml(g.openItem)}</div>`
        : "",
      `<div>${button(g.score === null ? "Run your rating" : `See the ${g.pointsToGate} points`, input.ratingUrl, true)}</div>`,
    ].join("");
  }

  const html = shell(
    `<div style="font-size:18px;font-weight:bold;margin:0 0 12px;">${escapeHtml(cap)}</div>` +
      `<p style="margin:0 0 14px;">${escapeHtml(lead)}</p>` +
      body,
  );

  return { subject: cap, text, html };
}
