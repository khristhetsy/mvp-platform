import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { InvestorCompanyReportView } from "@/components/InvestorCompanyReportView";
import { canInvestorPerformSensitiveActions } from "@/lib/investor/access";
import { loadInvestorCompanyReport } from "@/lib/investor/load-company-report";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorCompanyReportPage({
  params,
}: Readonly<{
  params: Promise<{ companyId: string }>;
}>) {
  const { companyId } = await params;
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);

  if (!canInvestorPerformSensitiveActions(investorProfile?.approval_status)) {
    redirect("/investor/opportunities");
  }

  const report = await loadInvestorCompanyReport(companyId, {
    investorId,
    logView: true,
  });

  if (!report) {
    notFound();
  }

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Company report"
    >
      <p className="mb-6 text-sm text-slate-500">
        <Link href="/investor/opportunities" className="font-semibold text-indigo-600 hover:text-indigo-500">
          ← Opportunities
        </Link>
      </p>
      <InvestorCompanyReportView report={report} viewerRole="investor" isOwnCompany={false} />
    </AppShell>
  );
}
