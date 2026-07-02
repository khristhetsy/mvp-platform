// Weekly activation-funnel digest for staff. Best-effort email (no-ops without
// RESEND_API_KEY) plus an in-app notification linking to /admin/funnels.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { notifyStaffIfNotRecent } from "@/lib/notifications/notifications";
import { loadActivationFunnels, type FunnelStep } from "@/lib/analytics/activation-funnels";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
}

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

function stepsHtml(steps: FunnelStep[]): string {
  return steps
    .map(
      (s) =>
        `<tr><td style="padding:4px 10px;color:#334155;">${s.label}</td><td style="padding:4px 10px;text-align:right;font-weight:600;">${s.count.toLocaleString()}</td><td style="padding:4px 10px;text-align:right;color:${(s.fromPrev ?? 1) < 0.5 ? "#dc2626" : "#94a3b8"};">${s.fromPrev === null ? "" : pct(s.fromPrev)}</td></tr>`,
    )
    .join("");
}

function stepsText(steps: FunnelStep[]): string {
  return steps.map((s) => `  ${s.label}: ${s.count}${s.fromPrev === null ? "" : ` (${pct(s.fromPrev)} from prev)`}`).join("\n");
}

export function buildFunnelDigestEmail(funnels: Awaited<ReturnType<typeof loadActivationFunnels>>): {
  subject: string;
  html: string;
  text: string;
} {
  const link = `${appUrl()}/admin/funnels`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#2E78F5;font-weight:600;margin:0 0 6px;">Weekly report</p>
    <h1 style="font-size:20px;margin:0 0 14px;">Activation funnels</h1>
    <h2 style="font-size:15px;margin:0 0 6px;color:#334155;">Founder activation</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 18px;border:1px solid #e2e8f0;border-radius:8px;">${stepsHtml(funnels.founder)}</table>
    <h2 style="font-size:15px;margin:0 0 6px;color:#334155;">Investor activation</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 18px;border:1px solid #e2e8f0;border-radius:8px;">${stepsHtml(funnels.investor)}</table>
    <a href="${link}" style="display:inline-block;background:#2E78F5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;">Open the full report →</a>
    <p style="font-size:11px;color:#94a3b8;margin:18px 0 0;">The red percentage marks the biggest drop between steps — the place to focus.</p>
  </div>`;

  const text = `Activation funnels — weekly report\n\nFounder activation:\n${stepsText(funnels.founder)}\n\nInvestor activation:\n${stepsText(funnels.investor)}\n\nFull report: ${link}`;

  return { subject: "Weekly activation funnels report", html, text };
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
    const ok = await sendEmail({ to: email, subject, html, text });
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
