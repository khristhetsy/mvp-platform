import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderLearningModuleViewer } from "@/components/FounderLearningModuleViewer";
import { getModuleContent } from "@/lib/learning/modules";
import { getLearningModuleBySlug, listLearningProgressForCompany } from "@/lib/learning/progress";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderLearningModulePage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const profile = await requireRole(["founder"]);
  const { slug } = await params;
  const company = await ensureFounderCompanyForUser(profile);

  if (!company) {
    notFound();
  }

  const module = await getLearningModuleBySlug(slug);
  const content = getModuleContent(slug);

  if (!module || !content || !module.is_published) {
    notFound();
  }

  const progressRows = await listLearningProgressForCompany(profile.id, company.id);
  const progress = progressRows.find((row) => row.module_id === module.id) ?? null;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company.company_name}
    >
      <FounderFeatureGate featureKey="elearning">
        <FounderLearningModuleViewer
          moduleId={module.id}
          moduleSlug={module.slug}
          title={module.title}
          content={content}
          initialProgress={progress}
        />
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
