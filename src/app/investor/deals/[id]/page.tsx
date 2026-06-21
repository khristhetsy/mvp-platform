import { AppShell } from "@/components/AppShell";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadInvestorCut } from "@/lib/diligence/investor";
import { InvestorCut } from "@/components/diligence/InvestorCut";

export const dynamic = "force-dynamic";

export default async function InvestorDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireInvestorWorkspaceSession();
  const { id } = await params;
  const payload = await loadInvestorCut(createServiceRoleClient(), id, profile.id);

  return (
    <AppShell role="INVESTOR" workspace="investor" profileName={profile.full_name ?? profile.email ?? "Investor"} profileSubtitle="Deal">
      {payload ? (
        <InvestorCut dealId={id} payload={payload} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Not available</h1>
          <p className="mt-1 text-sm text-slate-600">This deal package isn&apos;t available to you, or hasn&apos;t been released yet.</p>
        </div>
      )}
    </AppShell>
  );
}
