import { redirect } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderConversationalOnboarding } from "@/components/founder/FounderConversationalOnboarding";
import { loadFounderOnboardingPageData } from "@/lib/onboarding/load-founder-onboarding";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderOnboardingPage() {
  const profile = await requireRole(["founder"]);
  const data = await loadFounderOnboardingPageData(profile);

  if (!data) {
    redirect("/auth/sign-in");
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={data.company.company_name}
    >
      <div className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Founder onboarding</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Let&apos;s get you set up
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Answer a few quick questions. We&apos;ll personalise your experience and give you a clear starting action plan.
          </p>
        </div>

        <FounderConversationalOnboarding
          company={data.company}
          founderName={profile.full_name ?? profile.email ?? "Founder"}
        />
      </div>
    </FounderAppShell>
  );
}
