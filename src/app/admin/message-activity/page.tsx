import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requirePermissionPage } from "@/lib/api/permissions";
import { loadGoals, loadMessageActivity, todayLocal } from "@/lib/analytics/message-activity";
import {
  PERIOD_KINDS,
  addDays,
  daysBetween,
  periodRange,
  previousRange,
  type DayRange,
  type PeriodKind,
} from "@/lib/analytics/message-activity-metrics";
import { MessageActivityClient } from "@/components/admin/message-activity/MessageActivityClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ p?: string; a?: string; from?: string; to?: string }>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 731;

export default async function MessageActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("adminPages");
  const { profile, effective } = await requirePermissionPage("view_analytics");
  const params = await searchParams;
  const today = todayLocal();

  const kind: PeriodKind = (PERIOD_KINDS as string[]).includes(params.p ?? "") ? (params.p as PeriodKind) : "week";
  const anchor = params.a && DAY.test(params.a) && params.a <= today ? params.a : today;

  let range: DayRange;
  if (kind === "custom") {
    let start = params.from && DAY.test(params.from) ? params.from : addDays(today, -29);
    let end = params.to && DAY.test(params.to) ? params.to : today;
    if (start > end) [start, end] = [end, start];
    if (daysBetween(start, end) > MAX_CUSTOM_DAYS) start = addDays(end, -(MAX_CUSTOM_DAYS - 1));
    range = { start, end };
  } else {
    range = periodRange(kind, anchor);
  }
  const previous = previousRange(kind, range, anchor);

  // One read covers the period and the one before it, for the change figures.
  const [data, goals] = await Promise.all([
    loadMessageActivity({ start: previous.start, end: range.end }),
    loadGoals(),
  ]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("messageActivity")}
    >
      <MessageActivityClient
        key={`${kind}:${range.start}:${range.end}`}
        data={data}
        goals={goals.entries}
        goalsTableMissing={goals.tableMissing}
        kind={kind}
        anchor={anchor}
        range={range}
        previous={previous}
        today={today}
        canEditGoals={effective.permissions.includes("manage_reports")}
      />
    </AppShell>
  );
}
