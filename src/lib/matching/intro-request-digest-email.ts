/**
 * The daily admin digest of founder introduction requests. Pure.
 */
import { button, escapeHtml, shell } from "@/lib/activity/email-templates";

export type DigestRequest = { companyName: string; investorName: string; kind: "prospect" | "member" };

export type IntroDigestInput = {
  fresh: DigestRequest[];
  waiting: number;
  /** Age in whole days of the oldest request still waiting, or null when none wait. */
  oldestWaitingDays: number | null;
  prospectQueueUrl: string;
  memberQueueUrl: string;
};

const MAX_LISTED = 10;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function digestSubject(input: Pick<IntroDigestInput, "fresh" | "waiting">): string {
  if (input.fresh.length) return plural(input.fresh.length, "new introduction request", "new introduction requests");
  return `${plural(input.waiting, "introduction request", "introduction requests")} waiting on you`;
}

export function waitingLine(waiting: number, oldestDays: number | null): string | null {
  if (waiting <= 0) return null;
  const age =
    oldestDays === null ? "" : oldestDays < 1 ? ", oldest from today" : `, oldest ${plural(oldestDays, "day", "days")}`;
  return `Waiting on you: ${plural(waiting, "request", "requests")}${age}`;
}

/** Nothing to say: no new requests and nothing waiting. */
export function digestIsEmpty(input: Pick<IntroDigestInput, "fresh" | "waiting">): boolean {
  return input.fresh.length === 0 && input.waiting <= 0;
}

export function renderIntroDigestEmail(input: IntroDigestInput): { subject: string; text: string; html: string } {
  const subject = digestSubject(input);
  const listed = input.fresh.slice(0, MAX_LISTED);
  const more = input.fresh.length - listed.length;
  const lines = listed.map((r) => `${r.companyName} to ${r.investorName}${r.kind === "prospect" ? " (prospect)" : ""}`);
  if (more > 0) lines.push(`and ${more} more`);
  const waiting = waitingLine(input.waiting, input.oldestWaitingDays);

  const text = [
    input.fresh.length ? "New in the last 24 hours:" : "No new requests in the last 24 hours.",
    ...lines,
    waiting ? `\n${waiting}` : null,
    "",
    `Prospect requests: ${input.prospectQueueUrl}`,
    `Registered investor requests: ${input.memberQueueUrl}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const html = shell(
    `<div style="font-size:18px;font-weight:bold;margin:0 0 12px;">${escapeHtml(subject)}</div>` +
      (lines.length
        ? `<p style="margin:0 0 6px;color:#5F6B85;font-size:13px;">New in the last 24 hours</p>` +
          `<ul style="margin:0 0 14px;padding-left:18px;">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : `<p style="margin:0 0 14px;">No new requests in the last 24 hours.</p>`) +
      (waiting ? `<p style="margin:0 0 16px;font-weight:bold;">${escapeHtml(waiting)}</p>` : "") +
      `<div>${button("Prospect requests", input.prospectQueueUrl, true)}${button("Registered investor requests", input.memberQueueUrl, false)}</div>`,
    {
      audience: "admin",
      subject,
      preheader: waiting ?? subject,
      reason: "You get this because you hold the Marketing stage in Account Activity, or no one does and you are a super admin.",
    },
  );
  return { subject, text, html };
}
