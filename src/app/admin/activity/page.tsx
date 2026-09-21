import { AppShell } from "@/components/AppShell";
import { AccountActivityClient } from "@/components/admin/activity/AccountActivityClient";
import { requireRole } from "@/lib/supabase/auth";
import {
  activityCoverage,
  isDateRangeKey,
  loadActivityFeed,
  resolveDateRange,
  type DateRangeKey,
} from "@/lib/activity/feed";
import { loadStageAssignments } from "@/lib/activity/assignments";
import type { ActivityAudience } from "@/lib/activity/stages";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  audience?: string;
  range?: string;
  from?: string;
  to?: string;
  company?: string;
}>;

export default async function AdminActivityPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(["admin", "analyst"]);
  const params = await searchParams;

  const audience: ActivityAudience | "both" =
    params.audience === "investor" || params.audience === "both"
      ? params.audience
      : "founder";

  const range: DateRangeKey = params.range && isDateRangeKey(params.range) ? params.range : "30d";
  const window = resolveDateRange(range, { from: params.from, to: params.to });

  const [feed, board, coverage] = await Promise.all([
    loadActivityFeed({
      audience,
      from: window.from,
      to: window.to,
      companyId: params.company ?? null,
    }),
    loadStageAssignments(),
    activityCoverage(),
  ]);

  return (
    <AppShell>
      <AccountActivityClient
        audience={audience}
        range={range}
        customFrom={params.from ?? null}
        customTo={params.to ?? null}
        groups={feed.groups}
        totalInWindow={feed.totalInWindow}
        typeCounts={feed.typeCounts}
        assignments={board}
        coverage={coverage}
      />
    </AppShell>
  );
}
