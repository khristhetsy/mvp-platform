import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { founderProjects } from "@/lib/ir/founder-report";
import { OutreachReportClient } from "./OutreachReportClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach report" };

/** Founder portal: the investor outreach summary the iCFO Capital IR team shares (spec §6 founder view). */
export default async function OutreachReportPage() {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);
  const projects = company ? await founderProjects(company.id) : [];

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="Investor relations">
      {projects.length === 0 ? (
        <>
          <PageHeader eyebrow="Investor relations" title="Outreach report" description="Weekly and monthly summaries of the investor outreach the iCFO Capital team runs on your behalf." />
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Nothing shared yet</p>
            <p className="mt-1">Once the iCFO Capital investor relations team opens an outreach project for {company?.company_name ?? "your company"} and shares it, your summaries appear here — figures, pipeline, communications log and the written reports.</p>
          </div>
        </>
      ) : <OutreachReportClient projects={projects} />}
    </FounderAppShell>
  );
}
