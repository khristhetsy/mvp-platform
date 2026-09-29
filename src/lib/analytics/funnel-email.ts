// Weekly activation-funnel digest for staff. Best-effort email (no-ops without
// RESEND_API_KEY) plus an in-app notification linking to /admin/funnels.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { notifyStaffIfNotRecent } from "@/lib/notifications/notifications";
import { loadActivationFunnels, type FunnelStep } from "@/lib/analytics/activation-funnels";
import { renderEmail, type EmailBlock } from "@/lib/email/layout";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
}

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

function stepsText(steps: FunnelStep[]): string {
  return steps.map((s) => `  ${s.label}: ${s.count}${s.fromPrev === null ? "" : ` (${pct(s.fromPrev)} from prev)`}`).join("\n");
}

/** Index of the single largest drop between steps, or -1 when there is none. */
export function biggestDrop(steps: FunnelStep[]): number {
  let at = -1;
  let worst = 1;
  steps.forEach((s, i) => {
    if (s.fromPrev !== null && s.fromPrev < worst) {
      worst = s.fromPrev;
      at = i;
    }
  });
  return at;
}

function funnelBlock(title: string, steps: FunnelStep[]): EmailBlock {
  const drop = biggestDrop(steps);
  const top = Math.max(1, steps[0]?.count ?? 1);
  return {
    type: "rows",
    title,
    items: steps.map((s, i) => ({
      title: s.label,
      subtitle: s.fromPrev === null ? null : `${pct(s.fromPrev)} from previous step${i === drop ? " · biggest drop" : ""}`,
      right: s.count.toLocaleString("en-US"),
      bar: (s.count / top) * 100,
    })),
  };
}

export function buildFunnelDigestEmail(funnels: Awaited<ReturnType<typeof loadActivationFunnels>>): {
  subject: string;
  html: string;
  text: string;
} {
  const link = `${appUrl()}/admin/funnels`;
  const f = funnels.founder[biggestDrop(funnels.founder)];
  const headline = f ? `Biggest founder drop: ${f.label} (${pct(f.fromPrev)})` : "Activation funnels";
  const mail = renderEmail({
    audience: "admin",
    subject: f ? `Activation funnels: biggest drop is at ${f.label} (${pct(f.fromPrev)})` : "Weekly activation funnels report",
    preheader: "Founder and investor activation this week. The biggest drop in each funnel is marked.",
    context: "Weekly report",
    eyebrow: "Weekly report",
    headline,
    intro: "Each bar is the share of the first step that reached this one. The biggest drop in each funnel is the place to focus.",
    blocks: [funnelBlock("Founder activation", funnels.founder), funnelBlock("Investor activation", funnels.investor)],
    primary: { label: "Open the full report", url: link },
    footer: { reason: "Internal. Sent weekly to admin and analyst roles." },
  });

  const text = `Activation funnels, weekly report\n\nFounder activation:\n${stepsText(funnels.founder)}\n\nInvestor activation:\n${stepsText(funnels.investor)}\n\nFull report: ${link}`;

  return { subject: mail.subject, html: mail.html, text };
}

export async function sendFunnelDigestToAdmins(): Promise<{ admins: number; emailed: number }> {
  const funnels = await loadActivationFunnels();
  const { subject, html, text } = buildFunnelDigestEmail(funnels);

  const admin = createServiceRoleClient();
  const { data: staff } = await admin
    .from("profiles")
    .select("email")
    .in("role", ["admin", "analyst"]);

  const emails = (staff ?? [])
    .map((s) => (s as { email: string | null }).email)
    .filter((e): e is string => Boolean(e));

  let emailed = 0;
  for (const email of emails) {
    const ok = await sendEmail({ to: email, subject, html, text, fromName: "iCapOS Ops" });
    if (ok) emailed += 1;
  }

  // In-app heads-up (deduped so the twice-daily cron can't double-send within a day).
  await notifyStaffIfNotRecent({
    type: "activation_funnel_digest",
    title: "Weekly activation funnels are ready",
    message: "Your founder and investor activation funnels have been updated for the week.",
    entityType: "report",
    withinHours: 20,
  });

  return { admins: emails.length, emailed };
}
