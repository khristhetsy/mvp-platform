import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listRecentDiligenceReports } from "@/lib/data/founder-readiness";
import { DiligenceReportCompare, type DiligenceReportRow } from "@/components/founder/DiligenceReportCompare";

export const dynamic = "force-dynamic";

export default async function AdminReportComparePage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const profile = await requireRole(["admin", "analyst"]);
  const { companyId } = await params;
  const admin = createServiceRoleClient();

  const [{ data: company }, { data: reports }] = await Promise.all([
    admin.from("companies").select("company_name").eq("id", companyId).maybeSingle(),
    listRecentDiligenceReports(admin, companyId, 2),
  ]);

  const versions = (reports ?? []) as unknown as DiligenceReportRow[];
  const companyName = (company as { company_name?: string | null } | null)?.company_name ?? "Company";

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Admin account"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Diligence"
          title={`Compare reports — ${companyName}`}
          description="The two most recent diligence report versions for this company, side by side."
        />

        {versions.length < 2 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-900">Not enough versions to compare</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              This company has {versions.length === 1 ? "only one report" : "no reports"} so far. Generate another
              version to compare against the current one.
            </p>
          </div>
        ) : (
          <DiligenceReportCompare current={versions[0]} previous={versions[1]} />
        )}

        <div className="mt-6">
          <Link href={`/admin/companies/${companyId}`} className="text-sm font-medium text-indigo-600 hover:underline">
            ← Back to company workspace
          </Link>
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
