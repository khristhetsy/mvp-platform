// Budget alert emails: once per scope (category or total), month and threshold,
// when month to date spend first reaches 80% or 100%. Run by the
// ai-budget-alerts cron every 15 minutes. Server only.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { ALERT_THRESHOLDS, CATEGORY_LABELS, isCategory } from "./config";
import { getAiBudgetStatus } from "./service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => createServiceRoleClient();

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export async function sendAiBudgetAlerts(): Promise<{ sent: string[] }> {
  const rows = await getAiBudgetStatus();
  const scopes = [
    {
      scope: "total",
      label: "Total AI budget",
      budget: rows.reduce((s, r) => s + Number(r.monthly_usd), 0),
      spent: rows.reduce((s, r) => s + Number(r.spent_usd), 0),
    },
    ...rows
      .filter((r) => isCategory(r.category))
      .map((r) => ({ scope: r.category, label: CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS], budget: Number(r.monthly_usd), spent: Number(r.spent_usd) })),
  ];

  const month = monthStartIso();
  const sent: string[] = [];
  for (const s of scopes) {
    if (s.budget <= 0) continue;
    const pct = (s.spent / s.budget) * 100;
    // Highest threshold reached, so a jump straight past 100% sends one email.
    const reached = [...ALERT_THRESHOLDS].reverse().find((t) => pct >= t);
    if (!reached) continue;
    // Claim the alert row first; a conflict means it was already sent.
    const { error } = await db().from("ai_budget_alerts").insert({ scope: s.scope, month, threshold: reached });
    if (error) continue;
    if (reached === 100) {
      // Also mark 80%, so it doesn't fire after the 100% email.
      await db().from("ai_budget_alerts").insert({ scope: s.scope, month, threshold: 80 });
    }
    await sendAlertEmail(s.label, reached, s.spent, s.budget);
    sent.push(`${s.scope}:${reached}`);
  }
  return { sent };
}

async function sendAlertEmail(label: string, threshold: number, spent: number, budget: number): Promise<void> {
  const { data } = await db().from("ai_budget_settings").select("alert_email").eq("id", 1).maybeSingle();
  const to = (data?.alert_email as string | undefined)?.trim();
  if (!to) return;
  const stopped = threshold >= 100;
  const usd = (n: number) => `$${n.toFixed(2)}`;
  const subject = stopped ? `AI budget reached: ${label} has stopped` : `AI budget at ${threshold}%: ${label}`;
  const line = `${label}: ${usd(spent)} of ${usd(budget)} spent this month (${Math.round((spent / budget) * 100)}%).`;
  const next = stopped
    ? "AI calls billed to this budget are paused until the 1st of next month (UTC) or until you raise the budget."
    : "Calls keep running until this budget reaches 100%.";
  const where = "Manage budgets in Admin, Feature Controls, AI budget.";
  await sendEmail({ to, subject, html: `<p>${line}</p><p>${next}</p><p>${where}</p>`, text: `${line}\n\n${next}\n\n${where}` });
}
