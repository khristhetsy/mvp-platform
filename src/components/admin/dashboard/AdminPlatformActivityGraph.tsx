import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { AdminCrmActivityRow } from "@/lib/data/investor-crm";
import type { AdminInvestorActivityData } from "@/components/admin/dashboard/types";

type ActivityCategory = {
  key: string;
  label: string;
  count: number;
};

function countByTypes(activities: AdminCrmActivityRow[], types: string[]) {
  return activities.filter((row) => types.includes(row.activity_type)).length;
}

function buildActivityCategories(
  crmActivity: AdminCrmActivityRow[],
  investorActivity: AdminInvestorActivityData,
  companyUpdateCount: number,
): ActivityCategory[] {
  return [
    {
      key: "interests",
      label: "Investor Interests",
      count: Math.max(investorActivity.interests.length, countByTypes(crmActivity, ["expressed_interest", "pledge_amount_submitted"])),
    },
    {
      key: "intros",
      label: "Intro Requests",
      count: Math.max(investorActivity.introRequests.length, countByTypes(crmActivity, ["requested_intro"])),
    },
    {
      key: "saved",
      label: "Saved Deals",
      count: Math.max(investorActivity.savedDeals.length, countByTypes(crmActivity, ["saved_deal"])),
    },
    {
      key: "messages",
      label: "Messages",
      count: countByTypes(crmActivity, ["message_sent", "message_thread_created"]),
    },
    {
      key: "meetings",
      label: "Meetings",
      count: countByTypes(crmActivity, ["meeting_requested", "meeting_accepted", "meeting_declined"]),
    },
    {
      key: "updates",
      label: "Company Updates",
      count: companyUpdateCount,
    },
    {
      key: "spv",
      label: "SPV Activity",
      count: countByTypes(crmActivity, ["spv_interest_expressed"]),
    },
  ];
}

export function AdminPlatformActivityGraph({
  crmActivity,
  investorActivity,
  companyUpdateCount,
}: Readonly<{
  crmActivity: AdminCrmActivityRow[];
  investorActivity: AdminInvestorActivityData;
  companyUpdateCount: number;
}>) {
  const categories = buildActivityCategories(crmActivity, investorActivity, companyUpdateCount);
  const max = Math.max(...categories.map((c) => c.count), 1);
  const total = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <WorkspacePanel
      title="Platform activity"
      subtitle="Current snapshot from recent CRM events and loaded records"
      provenance="Not a time-series · counts reflect latest loaded activity"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="font-mono text-2xl font-semibold tabular-nums text-slate-950">{total}</p>
            <p className="text-xs text-slate-500">Combined activity signals in current view</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <div key={category.key} className="text-right">
                <p className="font-mono text-sm font-semibold tabular-nums text-slate-800">{category.count}</p>
                <p className="text-[10px] text-slate-500">{category.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2.5" aria-label="Platform activity by category">
          {categories.map((category) => (
            <div key={category.key} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3">
              <p className="truncate text-xs font-medium text-slate-700">{category.label}</p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[var(--navy)]/70 transition-all"
                  style={{ width: `${Math.max(4, (category.count / max) * 100)}%` }}
                />
              </div>
              <p className="text-right font-mono text-xs tabular-nums text-slate-600">{category.count}</p>
            </div>
          ))}
        </div>
      </div>
    </WorkspacePanel>
  );
}
