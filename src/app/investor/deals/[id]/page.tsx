import { AppShell } from "@/components/AppShell";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadInvestorCut } from "@/lib/diligence/investor";
import { InvestorCut } from "@/components/diligence/InvestorCut";
import { InvestorDataRoomQA } from "@/components/investor/InvestorDataRoomQA";
import { listInvestorQuestions } from "@/lib/data-room/qa";

export const dynamic = "force-dynamic";

export default async function InvestorDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");
  const { id } = await params;
  const service = createServiceRoleClient();
  const payload = await loadInvestorCut(service, id, profile.id);

  // Resolve the company behind this engagement so the investor can Q&A its data room.
  let companyId: string | null = null;
  let companyName: string | null = null;
  if (payload) {
    const { data: eng } = await (service as unknown as import("@supabase/supabase-js").SupabaseClient)
      .from("dd_engagements")
      .select("company_id, company_name")
      .eq("id", id)
      .maybeSingle();
    companyId = (eng as { company_id?: string } | null)?.company_id ?? null;
    companyName = (eng as { company_name?: string } | null)?.company_name ?? null;
  }
  const questions = companyId ? await listInvestorQuestions(companyId, profile.id) : [];

  return (
    <AppShell role="INVESTOR" workspace="investor" profileName={profile.full_name ?? profile.email ?? "Investor"} profileSubtitle={t("deal")}>
      {payload ? (
        <div className="space-y-6">
          <InvestorCut dealId={id} payload={payload} />
          {companyId && (
            <InvestorDataRoomQA companyId={companyId} companyName={companyName} initialQuestions={questions} />
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">{t("not_available")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("this_deal_package_isn_t_available_to_you_or_ha")}</p>
        </div>
      )}
    </AppShell>
  );
}
