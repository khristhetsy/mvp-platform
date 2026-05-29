import { listInvestorOwnCrmActivity, type InvestorActivityRow } from "@/lib/data/investor-crm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatActivityLabel(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function InvestorActivityTimelineSkeleton() {
  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 space-y-4">
        {[0, 1, 2].map((key) => (
          <div key={key} className="space-y-2 border-b border-slate-100 pb-4 last:border-b-0">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-56 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function InvestorActivityTimeline({ activities }: { activities: InvestorActivityRow[] }) {
  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Your activity</h2>
      <p className="mt-1 text-sm text-slate-600">A timeline of your marketplace actions.</p>

      <div className="mt-4 divide-y divide-slate-100">
        {activities.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">
            No activity yet. Save a deal or express interest to see your timeline here.
          </p>
        ) : (
          activities.map((row) => (
            <div key={row.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {formatActivityLabel(row.activity_type)}
                </span>
              </div>
              <p className="mt-1 font-medium text-slate-900">{row.company_name ?? "Unknown company"}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDate(row.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export async function InvestorActivityTimelineSection({ investorId }: { investorId: string }) {
  const supabase = await createServerSupabaseClient();
  const activities = await listInvestorOwnCrmActivity(supabase, investorId);

  return <InvestorActivityTimeline activities={activities} />;
}
