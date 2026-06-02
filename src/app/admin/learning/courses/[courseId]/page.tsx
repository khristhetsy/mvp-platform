import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { AdminCourseEditor } from "@/components/admin/learning/AdminCourseEditor";
import { AdminCourseModulesManager } from "@/components/admin/learning/AdminCourseModulesManager";
import { AdminCourseContentStudio } from "@/components/admin/learning/AdminCourseContentStudio";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function AdminLearningCourseDetailPage({ params }: PageProps) {
  const profile = await requireRole(["admin", "analyst"]);
  const { courseId } = await params;
  const supabase = createServiceRoleClient();

  const { data: program } = await supabase
    .from("learning_programs")
    .select(
      "id, slug, title, description, readiness_focus, content_status, is_published, category, difficulty, order_index, created_at",
    )
    .eq("id", courseId)
    .maybeSingle();

  const { data: links } = await supabase
    .from("learning_program_modules")
    .select("module_id, order_index")
    .eq("program_id", courseId)
    .order("order_index", { ascending: true });

  const moduleIds = (links ?? []).map((l) => l.module_id);
  type LinkedModuleRow = {
    id: string;
    slug: string;
    title: string;
    readiness_stage: string;
    category: string;
    is_published: boolean;
    content_status?: string;
    description?: string | null;
    estimated_time_minutes?: number | null;
    difficulty?: string | null;
    order_index?: number | null;
  };

  const { data: modules } = moduleIds.length
    ? await supabase
        .from("learning_modules")
        .select(
          "id, slug, title, readiness_stage, category, description, estimated_time_minutes, difficulty, content_status, is_published, order_index",
        )
        .in("id", moduleIds)
    : { data: [] as LinkedModuleRow[] };

  const [{ count: enrollments }, { count: completions }, { count: certs }, { count: quizAttempts }, { count: quizPasses }] =
    await Promise.all([
      supabase
        .from("learning_course_progress")
        .select("id", { count: "exact", head: true })
        .eq("program_id", courseId),
      supabase
        .from("learning_course_progress")
        .select("id", { count: "exact", head: true })
        .eq("program_id", courseId)
        .eq("status", "completed"),
      supabase
        .from("learning_certificates")
        .select("id", { count: "exact", head: true })
        .eq("program_id", courseId)
        .eq("status", "issued"),
      supabase
        .from("founder_quiz_attempts")
        .select("id", { count: "exact", head: true })
        .eq("module_slug", `course:${courseId}`),
      supabase
        .from("founder_quiz_attempts")
        .select("id", { count: "exact", head: true })
        .eq("module_slug", `course:${courseId}`)
        .eq("passed", true),
    ]);

  if (!program) {
    return (
      <AppShell
        role="ADMIN"
        workspace="admin"
        profileName={profile.full_name ?? profile.email ?? "Admin"}
        profileSubtitle={profile.role}
      >
        <WorkspacePageContainer>
          <PageHeader eyebrow="Admin Learning" title="Course not found" description="Invalid course id." />
        </WorkspacePageContainer>
      </AppShell>
    );
  }

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
          title={program.title}
          description="Educational content only. No investment/legal/tax advice."
          actions={
            <Link
              href="/admin/learning/courses"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to courses
            </Link>
          }
        />

        <section className="grid gap-6 xl:grid-cols-2">
          <WorkspacePanel title="Course editor" subtitle="Metadata, workflow status, publish flags">
            <AdminCourseEditor
              mode="edit"
              initial={{
                id: program.id,
                slug: program.slug,
                title: program.title,
                description: program.description,
                readiness_focus: program.readiness_focus,
                category: program.category,
                difficulty: program.difficulty,
                content_status: program.content_status,
                is_published: program.is_published,
                order_index: program.order_index ?? 0,
              }}
            />
          </WorkspacePanel>

          <WorkspacePanel title="Modules" subtitle="Link modules into this course; reorder by index">
            <AdminCourseModulesManager
              courseId={program.id}
              initialLinks={(links ?? []).map((l) => ({ module_id: l.module_id, order_index: l.order_index }))}
              initialModules={modules ?? []}
            />
            <div className="mt-3 text-xs text-slate-500">
              Note: founder learning module rendering remains code-driven in Phase 1. Admin module linking is operational metadata only.
            </div>
          </WorkspacePanel>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <WorkspacePanel title="Founder analytics" subtitle="Admin visibility (Phase 2)">
            <dl className="grid gap-2 text-sm text-slate-700">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Enrollments</dt>
                <dd className="font-semibold">{String(enrollments ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Completions</dt>
                <dd className="font-semibold">{String(completions ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Certificates issued</dt>
                <dd className="font-semibold">{String(certs ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Quiz attempts</dt>
                <dd className="font-semibold">{String(quizAttempts ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Quiz passes</dt>
                <dd className="font-semibold">{String(quizPasses ?? 0)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Educational analytics only. No private founder messages or documents.
            </p>
          </WorkspacePanel>
        </section>

        <section className="mt-6">
          <WorkspacePanel title="Modules, lessons, quizzes" subtitle="Phase 1 admin management (founder learning remains unchanged)">
            <AdminCourseContentStudio courseId={program.id} linkedModules={(modules ?? []) as LinkedModuleRow[]} />
          </WorkspacePanel>
        </section>
      </WorkspacePageContainer>
    </AppShell>
  );
}

