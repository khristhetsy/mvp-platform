import { redirect } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderConversationalOnboarding } from "@/components/founder/FounderConversationalOnboarding";
import { FounderOnboardingProgressCard } from "@/components/FounderOnboardingProgressCard";
import { loadFounderOnboardingPageData } from "@/lib/onboarding/load-founder-onboarding";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { advanceFounderJourney } from "@/lib/founder-journey/stage-gate";

export const dynamic = "force-dynamic";

export default async function FounderOnboardingPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const data = await loadFounderOnboardingPageData(profile);

  if (!data) {
    redirect("/auth/sign-in");
  }

  // If onboarding is now complete, promote the founder so they don't linger at
  // Stage 1 with the workspace locked.
  const supabase = await createServerSupabaseClient();
  await advanceFounderJourney(supabase, profile.id).catch(() => { /* non-blocking */ });

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={data.company.company_name}
    >
      <div className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("founder_onboarding")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Let&apos;s get you set up
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Answer a few quick questions. We&apos;ll personalise your experience and give you a clear starting action plan.
          </p>
        </div>

        <FounderOnboardingProgressCard progress={data.progress} inPage />

        <FounderConversationalOnboarding
          company={data.company}
          founderName={profile.full_name ?? profile.email ?? "Founder"}
        />
      </div>
    </FounderAppShell>
  );
}
