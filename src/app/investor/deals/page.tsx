import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listInvestorDeals } from "@/lib/diligence/investor";

export const dynamic = "force-dynamic";

export default async function InvestorDealsPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const deals = await listInvestorDeals(createServiceRoleClient(), profile.id);

  return (
    <AppShell role="INVESTOR" workspace="investor" profileName={profile.full_name ?? profile.email ?? "Investor"} profileSubtitle="Deals">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6cb0]">iCFO CapitalOS</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            <ShieldCheck className="h-6 w-6 text-[#2f6cb0]" strokeWidth={1.75} aria-hidden /> Deals
          </h1>
          <p className="mt-1 text-sm text-slate-600">Released diligence packages shared with you.</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          {deals.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No deals have been shared with you yet.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {deals.map((d) => (
                <li key={d.id}>
                  <Link href={`/investor/deals/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                    <div>
                      <p className="font-medium text-slate-900">{d.company_name}</p>
                      <p className="text-xs text-slate-500">{[d.round_label, d.sector].filter(Boolean).join(" · ") || d.report_code}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
