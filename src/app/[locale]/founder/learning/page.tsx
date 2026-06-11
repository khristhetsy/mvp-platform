import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderCourseCatalog } from "@/components/FounderCourseCatalog";
import { FounderLeaderboard } from "@/components/founder/learning/FounderLeaderboard";
import { LessonSearch } from "@/components/founder/learning/LessonSearch";
import { QuizReviewBanner } from "@/components/founder/learning/QuizReviewBanner";
import { loadFounderCourseCatalog } from "@/lib/learning/load-founder-courses";
import { getLeaderboard } from "@/lib/learning/progress";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderLearningPage() {
  const profile = await requireRole(["founder"]);
  const { courses, categories, overallPercent, company } = await loadFounderCourseCatalog(profile);
  const leaderboard = company ? await getLeaderboard(company.id) : [];
  const companyName = company?.company_name ?? "Your company";

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={companyName}
    >
      <FounderFeatureGate featureKey="elearning">
        <div className="space-y-6">
          <QuizReviewBanner />
          <LessonSearch />
          <FounderCourseCatalog courses={courses} categories={categories} overallPercent={overallPercent} />
          <FounderLeaderboard entries={leaderboard} />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
