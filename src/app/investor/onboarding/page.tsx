import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { InvestorApprovalBanner } from "@/components/InvestorApprovalBanner";
import { InvestorOnboardingWizard } from "@/components/InvestorOnboardingWizard";
import { ensureInvestorProfileForUser } from "@/lib/investor/profile";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorOnboardingPage() {
  const profile = await requireRole(["investor"]);
  const investorProfile = await ensureInvestorProfileForUser(profile.id);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor onboarding"
    >
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Investor onboarding</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Submit your investing profile for admin review. Approved investors receive full workspace access at no cost.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          <Link href="/investor/dashboard" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Back to dashboard
          </Link>
        </p>
      </div>

      <InvestorApprovalBanner investorProfile={investorProfile} />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <InvestorOnboardingWizard
          investorProfile={investorProfile}
          profileName={profile.full_name ?? profile.email ?? "Investor"}
        />
      </section>
    </AppShell>
  );
}
