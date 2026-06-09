import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { AdminCourseEditor } from "@/components/admin/learning/AdminCourseEditor";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminNewLearningCoursePage() {
  if (isAdminModuleComingSoon("learning")) {
    redirect("/admin/learning");
  }

  const profile = await requireRole(["admin", "analyst"]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Admin Learning"
          title="New course"
          description="Create a new course (program). Educational content only."
          metadata="Educational content only. No investment/legal/tax advice. No funding guarantees."
        />
        <WorkspacePanel title="Course editor" subtitle="Phase 1">
          <AdminCourseEditor
            mode="create"
            initial={{
              slug: "new-course-slug",
              title: "New course title",
              description: "Describe the educational goals and learning outcomes for founders.",
              readiness_focus: "foundation",
              category: "Learning",
              difficulty: "intermediate",
              content_status: "draft",
              is_published: false,
              order_index: 0,
            }}
          />
        </WorkspacePanel>
      </WorkspacePageContainer>
    </AppShell>
  );
}

