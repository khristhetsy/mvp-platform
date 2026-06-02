import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { AdminCertificatesIssuer } from "@/components/admin/learning/AdminCertificatesIssuer";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminLearningCertificatesPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();

  const { data: certs } = await supabase
    .from("learning_certificates")
    .select("id, founder_id, company_id, program_id, certificate_title, certificate_code, status, issued_at")
    .order("issued_at", { ascending: false })
    .limit(200);

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
          title="Certificates"
          description="Certificates of Completion only. No investment qualification, no guarantees."
          metadata="Phase 1: manual issuance and listing"
        />

        <section className="grid gap-6 xl:grid-cols-2">
          <WorkspacePanel title="Issue certificate" subtitle="Manual staff issuance (Phase 1)">
            <AdminCertificatesIssuer />
          </WorkspacePanel>

          <WorkspacePanel title="Issued certificates" subtitle={`${(certs ?? []).length} recent`}>
          {(certs ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No certificates issued yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Founder</th>
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Issued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(certs ?? []).map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-medium text-slate-900">{c.certificate_title}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{String(c.founder_id).slice(0, 8)}…</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{c.program_id ? String(c.program_id).slice(0, 8) + "…" : "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.certificate_code}</td>
                      <td className="px-3 py-2">{c.status}</td>
                      <td className="px-3 py-2">{new Date(String(c.issued_at)).toLocaleDateString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WorkspacePanel>
        </section>
      </WorkspacePageContainer>
    </AppShell>
  );
}

