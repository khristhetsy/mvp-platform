import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminLearningCoursesPage() {
  if (isAdminModuleComingSoon("learning")) {
    redirect("/admin/learning");
  }

  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();

  const { data: programs } = await supabase
    .from("learning_programs")
    .select("id, slug, title, readiness_focus, content_status, is_published, created_at")
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
          eyebrow="Admin Learning"
          title="Courses"
          description="Educational content only. No investment/legal/tax advice."
          actions={
            <Link
              href="/admin/learning/courses/new"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              New course
            </Link>
          }
        />

        <WorkspacePanel title="All courses" subtitle={`${(programs ?? []).length} programs`}>
          {(programs ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No courses found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Slug</th>
                    <th className="px-3 py-2">Readiness</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Published</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(programs ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        <Link href={`/admin/learning/courses/${p.id}`} className="text-indigo-700 hover:underline">
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{p.slug}</td>
                      <td className="px-3 py-2 text-slate-700">{p.readiness_focus}</td>
                      <td className="px-3 py-2 text-slate-700">{p.content_status ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-700">{p.is_published ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WorkspacePanel>
      </WorkspacePageContainer>
    </AppShell>
  );
}

