import Link from "next/link";
import { redirect } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderOnboardingWizard } from "@/components/FounderOnboardingWizard";
import { FounderRemediationActionPlan } from "@/components/FounderRemediationActionPlan";
import { loadFounderOnboardingPageData } from "@/lib/onboarding/load-founder-onboarding";
import { loadFounderRemediationPlan } from "@/lib/remediation/load-founder-remediation";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderOnboardingPage() {
  const profile = await requireRole(["founder"]);
  const [data, remediation] = await Promise.all([
    loadFounderOnboardingPageData(profile),
    loadFounderRemediationPlan(profile),
  ]);

  if (!data) {
    redirect("/auth/sign-in");
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={data.company.company_name}
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Founder onboarding</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Build investor readiness during your trial
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Complete each step to strengthen your company profile, diligence posture, and visibility to institutional
            investors. Progress is saved automatically — resume anytime.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            <Link href="/founder/dashboard" className="font-semibold text-indigo-600 hover:text-indigo-500">
              Skip to dashboard
            </Link>
            {" · "}
            <Link href="/founder/readiness" className="font-semibold text-indigo-600 hover:text-indigo-500">
              Improve readiness
            </Link>
          </p>
        </div>

        <div className="mt-8">
          <FounderOnboardingWizard
            company={data.company}
            documents={data.documents}
            initialProgress={data.progress}
          />
        </div>

        {remediation.summary.active > 0 ? (
          <div className="mt-8">
            <FounderRemediationActionPlan
              tasks={remediation.tasks}
              summary={remediation.summary}
              compact
              title="Gaps to close while onboarding"
            />
          </div>
        ) : null}
      </section>
    </FounderAppShell>
  );
}
