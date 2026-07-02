import { AppShell } from "@/components/AppShell";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadInvestorCut } from "@/lib/diligence/investor";
import { InvestorCut } from "@/components/diligence/InvestorCut";

export const dynamic = "force-dynamic";

export default async function InvestorDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");
  const { id } = await params;
  const payload = await loadInvestorCut(createServiceRoleClient(), id, profile.id);

  return (
    <AppShell role="INVESTOR" workspace="investor" profileName={profile.full_name ?? profile.email ?? "Investor"} profileSubtitle={t("deal")}>
      {payload ? (
        <InvestorCut dealId={id} payload={payload} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">{t("not_available")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("this_deal_package_isn_t_available_to_you_or_ha")}</p>
        </div>
      )}
    </AppShell>
  );
}
