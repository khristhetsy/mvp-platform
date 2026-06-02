import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
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
    .select("id, slug, title, description, readiness_focus, content_status, is_published, category, difficulty, created_at")
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
  };

  const { data: modules } = moduleIds.length
    ? await supabase
        .from("learning_modules")
        .select("id, slug, title, readiness_stage, category, content_status, is_published")
        .in("id", moduleIds)
    : { data: [] as LinkedModuleRow[] };

  const modulesById = new Map((modules ?? []).map((m) => [m.id, m]));

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
          <WorkspacePanel title="Metadata" subtitle="Phase 1 view-only">
            <dl className="grid gap-2 text-sm text-slate-700">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Slug</dt>
                <dd className="font-mono text-xs">{program.slug}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Readiness focus</dt>
                <dd>{program.readiness_focus}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd>{program.content_status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Published</dt>
                <dd>{program.is_published ? "Yes" : "No"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Phase 1: edit/publish UI + approvals API will be added next in this branch.
            </p>
          </WorkspacePanel>

          <WorkspacePanel title="Modules" subtitle={`${(links ?? []).length} linked modules`}>
            {(links ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">No modules linked to this course yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(links ?? []).map((l) => {
                  const m = modulesById.get(l.module_id);
                  return (
                    <div key={l.module_id} className="py-3 text-sm">
                      <p className="font-medium text-slate-900">{m?.title ?? l.module_id}</p>
                      <p className="text-xs text-slate-500">
                        {m?.slug ?? "—"} · {m?.readiness_stage ?? "—"} · status: {m?.content_status ?? "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </WorkspacePanel>
        </section>
      </WorkspacePageContainer>
    </AppShell>
  );
}

