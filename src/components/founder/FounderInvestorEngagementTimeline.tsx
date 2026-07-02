import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getTranslations } from "next-intl/server";

type EventType = "viewed" | "saved" | "interested" | "intro_requested";

type EngagementEvent = {
  id: string;
  type: EventType;
  date: string;
  investorTypeLabel: string;
};

const EVENT_META: Record<
  EventType,
  { label: string; dotColor: string; bgColor: string; textColor: string }
> = {
  viewed: {
    label: "Viewed your diligence report",
    dotColor: "bg-indigo-400",
    bgColor:  "bg-indigo-50",
    textColor: "text-indigo-700",
  },
  saved: {
    label: "Saved your company to watchlist",
    dotColor: "bg-blue-400",
    bgColor:  "bg-blue-50",
    textColor: "text-blue-700",
  },
  interested: {
    label: "Expressed investment interest",
    dotColor: "bg-amber-400",
    bgColor:  "bg-amber-50",
    textColor: "text-amber-700",
  },
  intro_requested: {
    label: "Requested an introduction",
    dotColor: "bg-emerald-500",
    bgColor:  "bg-emerald-50",
    textColor: "text-emerald-700",
  },
};

function mapInvestorType(raw: string | null): string {
  switch (raw) {
    case "venture_fund":  return "VC";
    case "individual":    return "Angel";
    case "angel_group":   return "Angel group";
    case "family_office": return "Family office";
    case "corporate":     return "Corporate";
    default:              return "Investor";
  }
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

async function loadEngagementEvents(companyId: string): Promise<EngagementEvent[]> {
  const admin = createServiceRoleClient();
  const LIMIT = 25;

  const [viewsResult, savesResult, interestsResult, introsResult] = await Promise.all([
    // Report views — investor_activity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("investor_activity")
      .select("id, created_at, investor_profiles!investor_id(investor_type)")
      .eq("company_id", companyId)
      .eq("activity_type", "report_viewed")
      .order("created_at", { ascending: false })
      .limit(LIMIT),

    // Saved deals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("saved_deals")
      .select("id, created_at, investor_profiles!investor_id(investor_type)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(LIMIT),

    // Investor interests
    admin
      .from("investor_interests")
      .select("id, created_at, investor_profiles!investor_id(investor_type)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(LIMIT),

    // Intro requests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("intro_requests")
      .select("id, created_at, investor_profiles!investor_id(investor_type)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);

  type RawRow = {
    id: string;
    created_at: string;
    investor_profiles: { investor_type?: string | null } | Array<{ investor_type?: string | null }> | null;
  };

  function extractType(profiles: RawRow["investor_profiles"]): string | null {
    const p = Array.isArray(profiles) ? profiles[0] : profiles;
    return p?.investor_type ?? null;
  }

  const events: EngagementEvent[] = [];

  for (const row of ((viewsResult as { data: RawRow[] | null }).data ?? [])) {
    events.push({ id: `view-${row.id}`, type: "viewed", date: row.created_at, investorTypeLabel: mapInvestorType(extractType(row.investor_profiles)) });
  }
  for (const row of ((savesResult as { data: RawRow[] | null }).data ?? [])) {
    events.push({ id: `save-${row.id}`, type: "saved", date: row.created_at, investorTypeLabel: mapInvestorType(extractType(row.investor_profiles)) });
  }
  for (const row of ((interestsResult as { data: RawRow[] | null }).data ?? [])) {
    events.push({ id: `int-${row.id}`, type: "interested", date: row.created_at, investorTypeLabel: mapInvestorType(extractType(row.investor_profiles)) });
  }
  for (const row of ((introsResult as { data: RawRow[] | null }).data ?? [])) {
    events.push({ id: `intro-${row.id}`, type: "intro_requested", date: row.created_at, investorTypeLabel: mapInvestorType(extractType(row.investor_profiles)) });
  }

  // Sort descending by date, take top 30
  events.sort((a, b) => b.date.localeCompare(a.date));
  return events.slice(0, 30);
}

export async function FounderInvestorEngagementTimeline({
  companyId,
}: {
  companyId: string;
}) {
  const t = await getTranslations("founderCmp");
  const events = await loadEngagementEvents(companyId);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("investor_engagement_timeline")}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          All investor interactions — anonymized by type
        </p>
      </div>

      {events.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-600">{t("no_investor_activity_yet")}</p>
          <p className="mt-1 text-xs text-slate-400">
            Events appear here once investors engage with your marketplace listing.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {events.map((event) => {
            const meta = EVENT_META[event.type];
            return (
              <div key={event.id} className="flex items-start gap-3 px-5 py-3">
                {/* Timeline dot */}
                <div className="mt-1.5 flex w-6 shrink-0 flex-col items-center">
                  <span className={`h-2.5 w-2.5 rounded-full ${meta.dotColor}`} />
                </div>

                {/* Event detail */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.bgColor} ${meta.textColor}`}>
                      {event.investorTypeLabel}
                    </span>
                    <p className="text-xs text-slate-600">{meta.label}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">{formatEventDate(event.date)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-slate-100 px-5 py-2.5">
        <p className="text-[10px] text-slate-400">
          Investor identities are anonymized — only type is shown
        </p>
      </div>
    </div>
  );
}
