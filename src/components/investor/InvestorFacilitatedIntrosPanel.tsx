import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type FacilitatedRow = {
  id: string;
  company_id: string | null;
  facilitated_at: string | null;
  created_at: string | null;
  companies:
    | { company_name?: string | null; industry?: string | null; slug?: string | null }
    | Array<{ company_name?: string | null; industry?: string | null; slug?: string | null }>
    | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function loadFacilitatedIntros(investorId: string): Promise<FacilitatedRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (admin as any)
    .from("intro_requests")
    .select(
      "id, company_id, facilitated_at, created_at, companies(company_name, industry, slug)",
    )
    .eq("investor_id", investorId)
    .eq("status", "facilitated")
    .order("facilitated_at", { ascending: false });

  const { data } = result as { data: FacilitatedRow[] | null; error: unknown };
  return data ?? [];
}

export async function InvestorFacilitatedIntrosPanel({
  investorId,
}: {
  investorId: string;
}) {
  const t = await getTranslations("investorCmp");
  const rows = await loadFacilitatedIntros(investorId);

  if (rows.length === 0) {
    return (
      <div className="mb-8 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
        <p className="text-sm font-medium text-slate-600">{t("no_facilitated_connections_yet")}</p>
        <p className="mt-1 text-xs text-slate-400">
          When an admin facilitates an intro request, the company appears here as a portfolio connection.
        </p>
        <Link
          href="/investor/opportunities"
          className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Browse opportunities →
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{t("facilitated_connections")}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Companies where your intro request was facilitated by the iCapOS team
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          {rows.length} connection{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
          const name = company?.company_name ?? `Company ${row.company_id ?? ""}`;
          const industry = company?.industry;
          const reportHref = `/investor/opportunities/${row.company_id ?? ""}/report`;

          return (
            <div
              key={row.id}
              className="group rounded-xl border border-emerald-100 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                {/* Status badge */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <svg viewBox="0 0 8 8" className="h-2 w-2 fill-emerald-500">
                      <circle cx="4" cy="4" r="4" />
                    </svg>
                    Intro facilitated
                  </span>
                </div>

                {/* Company name */}
                <p className="text-sm font-semibold text-slate-900 leading-snug">{name}</p>
                {industry && (
                  <p className="mt-0.5 text-xs text-slate-500">{industry}</p>
                )}

                {/* Date */}
                <p className="mt-2 text-[11px] text-slate-400">
                  Facilitated {formatDate(row.facilitated_at ?? row.created_at)}
                </p>
              </div>

              {/* Footer link */}
              <div className="border-t border-slate-100 px-4 py-2.5">
                <Link
                  href={reportHref}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  View diligence report →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
