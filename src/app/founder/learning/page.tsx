import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderCourseCatalog } from "@/components/FounderCourseCatalog";
import { loadFounderCourseCatalog } from "@/lib/learning/load-founder-courses";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderLearningPage() {
  const profile = await requireRole(["founder"]);
  const { courses, categories, overallPercent, company } = await loadFounderCourseCatalog(profile);
  const companyName = company?.company_name ?? "Your company";

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={companyName}
    >
      <FounderFeatureGate featureKey="elearning">
        <FounderCourseCatalog courses={courses} categories={categories} overallPercent={overallPercent} />
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
