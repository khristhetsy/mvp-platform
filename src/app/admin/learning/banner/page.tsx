import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { AdminLearningBannerManager, type BannerProgram } from "@/components/admin/learning/AdminLearningBannerManager";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminLearningBannerPage() {
  if (isAdminModuleComingSoon("learning")) {
    redirect("/admin/learning");
  }

  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("learning_programs")
    .select("id, title, description, readiness_focus, is_published, order_index, promo_headline, promo_blurb, promo_cta_label, show_in_banner")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Admin"
          title="Learning banner"
          description="Choose which courses the founder Learning banner promotes, in what order, and what it says."
          actions={
            <Link
              href="/admin/learning/courses"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              All courses
            </Link>
          }
        />
        <WorkspacePanel title="Banner programs" subtitle="The banner shows the first 5 slides. Coached course and Capital readiness always come first.">
          {error ? (
            <p className="text-sm text-rose-700">
              The banner columns are missing. Apply the migration 20261020140000_learning_programs_banner.sql, then reload this page.
            </p>
          ) : (
            <AdminLearningBannerManager initial={(data ?? []) as unknown as BannerProgram[]} />
          )}
        </WorkspacePanel>
      </WorkspacePageContainer>
    </AppShell>
  );
}
