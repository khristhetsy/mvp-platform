import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requirePermissionPage } from "@/lib/api/permissions";
import { loadGoals, loadMessageActivity, todayParis } from "@/lib/analytics/message-activity";
import { METRICS, addMonths, metricValue, parisDay } from "@/lib/analytics/message-activity-metrics";
import { MessageGoalsClient, type MetricHistory } from "@/components/admin/message-activity/MessageGoalsClient";

export const dynamic = "force-dynamic";

export default async function MessageGoalsPage() {
  const t = await getTranslations("adminPages");
  const { profile, effective } = await requirePermissionPage("view_analytics");
  const today = todayParis();
  const thisMonth = today.slice(0, 7);
  const months = [-3, -2, -1].map((n) => addMonths(`${thisMonth}-01`, n).slice(0, 7));

  const [data, goals] = await Promise.all([
    loadMessageActivity({ start: `${months[0]}-01`, end: today }),
    loadGoals(),
  ]);

  // Monthly actuals per metric: every founder, no plan or search filter.
  const founders = new Set(data.people.filter((p) => p.role === "founder").map((p) => p.key));
  const slice = (month: string) => ({
    received: data.received.filter((r) => founders.has(r.personKey) && parisDay(r.at).startsWith(month)),
    sent: data.sent.filter((s) => parisDay(s.at).startsWith(month)),
  });
  const byMonth = [...months, thisMonth].map(slice);
  const history: MetricHistory[] = METRICS.map((m) => ({
    key: m.key,
    months: months.map((month, i) => ({ month, value: metricValue(m.key, byMonth[i]) })),
    monthToDate: metricValue(m.key, byMonth[3]),
  }));

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("messageGoals")}
    >
      <MessageGoalsClient
        entries={goals.entries}
        tableMissing={goals.tableMissing}
        history={history}
        today={today}
        emailLogStart={data.emailLogStart}
        canEdit={effective.permissions.includes("manage_reports")}
      />
    </AppShell>
  );
}
