/** Labels for the email log (Admin, Activity, Sent). Pure; safe in client code. */

export type EmailResult = { key: "failed" | "skipped" | "spam" | "bounced" | "clicked" | "opened" | "delivered" | "sent"; text: string; tone: "bad" | "warn" | "good" | "info" | "muted"; hint: string };

export function emailResult(e: {
  status: "sent" | "failed" | "skipped";
  error?: string | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
  clickedAt?: string | null;
  bouncedAt?: string | null;
  complainedAt?: string | null;
}): EmailResult {
  if (e.status === "failed") return { key: "failed", text: "Failed", tone: "bad", hint: e.error ?? "The email provider refused the send." };
  if (e.status === "skipped") return { key: "skipped", text: "Not sent", tone: "warn", hint: e.error ?? "Email was not configured when this ran." };
  if (e.complainedAt) return { key: "spam", text: "Marked as spam", tone: "bad", hint: "The recipient reported this email as spam." };
  if (e.bouncedAt) return { key: "bounced", text: "Bounced", tone: "bad", hint: "The recipient's mail server rejected it." };
  if (e.clickedAt) return { key: "clicked", text: "Clicked", tone: "good", hint: "Opened and a link was clicked." };
  if (e.openedAt) return { key: "opened", text: "Opened", tone: "good", hint: "Opened by the recipient. Some mail apps open emails automatically." };
  if (e.deliveredAt) return { key: "delivered", text: "Delivered", tone: "info", hint: "Accepted by the recipient's mail server." };
  return { key: "sent", text: "Sent", tone: "muted", hint: "Handed to the email provider. No delivery report yet." };
}

const SOURCES: Record<string, string> = {
  welcome_letter: "Welcome letter",
  "investor-intro": "Investor intro",
  "investor-intro-made": "Investor intro made",
  "intro-request-digest": "Intro request digest",
  "manual-outreach": "Manual outreach",
  "marketplace-offering-live": "Offering live",
  "ir-report": "Investor Relations report",
  "ir-report-copy": "Investor Relations report copy (Email me)",
  "ir-weekly-summary": "Investor Relations weekly summary",
  "ir-investor-email": "Investor Relations investor email",
  "ir-sequence-alert": "Investor Relations sequence alert",
  diligence: "Diligence",
  "e-signature": "E-signature",
  "marketing-campaign": "Marketing campaign",
  "marketing-copy": "Marketing copy",
  "marketing-copy-test": "Marketing copy test",
  "live-agent-request": "Live agent request",
  app: "Platform",
};

function words(s: string): string {
  const w = s.replace(/[-_]+/g, " ").trim();
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : s;
}

/** "job:/api/cron/stage-gate-reminders" → "Scheduled · Stage gate reminders". */
export function sourceLabel(source: string): string {
  if (SOURCES[source]) return SOURCES[source];
  if (source.startsWith("job:")) return `Scheduled · ${words(source.slice(4).replace(/^\/?api\/cron\//, ""))}`;
  if (source.includes("/")) {
    const page = source.endsWith(" (page)");
    const path = source.replace(/ \(page\)$/, "").replace(/^api\//, "");
    const parts = path.split("/").filter((p) => p && !p.startsWith("["));
    const tail = parts.slice(-2).map(words).join(" · ");
    return page ? `Page · ${tail}` : tail;
  }
  return words(source);
}

export const ROLE_LABEL: Record<"founder" | "investor" | "staff" | "external", string> = {
  founder: "Founder",
  investor: "Investor",
  staff: "Staff",
  external: "External",
};
