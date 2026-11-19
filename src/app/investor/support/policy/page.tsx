import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { SupportPolicyContent } from "@/components/support/SupportPolicyContent";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support policy" };

export default async function InvestorSupportPolicyPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const investorName = profile.full_name ?? profile.email ?? "Investor";

  return (
    <AppShell role="INVESTOR" workspace="investor" profileName={investorName} profileSubtitle="Support">
      <WorkspacePageContainer>
        <Link href="/investor/support" className="text-[13px] font-semibold text-indigo-700 hover:text-indigo-900">
          <span aria-hidden="true">←</span> Back to Support
        </Link>
        <div className="mt-3">
          <PageHeader eyebrow="Help" title="Customer Support Policy" description="What to expect when you contact the iCFO team." />
        </div>
        <SupportPolicyContent audience="investor" />
      </WorkspacePageContainer>
    </AppShell>
  );
}
