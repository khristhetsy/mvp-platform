import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { MetricCard } from "@/components/MetricCard";
import { Section, Tag } from "@/components/admin/investor-directory/ui";
import { listImports, loadSettings, networkInvestorCounts, overviewStats } from "@/lib/investor-directory/db";
import { DIRECTORY_DISCLAIMER } from "@/lib/investor-directory/types";

export const dynamic = "force-dynamic";

/** Investor Directory › Overview. Numbers come straight from the directory tables. */
export default async function InvestorDirectoryOverviewPage() {
  await requireRole(["admin"]);
  const settings = await loadSettings();
  const [stats, network, imports] = await Promise.all([overviewStats(settings), networkInvestorCounts(), listImports()]);
  const emailPct = stats.published ? Math.round((stats.withEmail / stats.published) * 100) : null;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Investor directory</h1>
        <p className="mt-1 text-[13px] text-slate-500">Public investor data that founders search and import into Manual outreach. {DIRECTORY_DISCLAIMER}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
        <MetricCard audience="admin" label="Published records" value={stats.published.toLocaleString("en-US")} detail={`${stats.drafts.toLocaleString("en-US")} drafts waiting to publish`} href="/admin/investor-directory/records?status=published" />
        <MetricCard audience="admin" label="With email" value={stats.withEmail.toLocaleString("en-US")} unit={`of ${stats.published.toLocaleString("en-US")}`} detail="Published records founders can email after import"
          ring={emailPct === null ? { percent: null, pending: true } : { percent: emailPct, center: `${emailPct}%` }} href="/admin/investor-directory/records?status=published" />
        <MetricCard audience="admin" label="Due for verification" value={stats.dueForVerify.toLocaleString("en-US")} detail={`Unverified, missing industries, bounced, or verified over ${settings.stale_days} days ago`}
          flag={stats.dueForVerify > 0 ? { text: "Work the queue before publishing more", tone: "warn" } : null} href="/admin/investor-directory/verification" />
        <MetricCard audience="admin" label="Opt-out requests" value={stats.optOuts.toLocaleString("en-US")} detail="Suppressed and removed from every founder's list" href="/admin/investor-directory/records?verification=opt_out" />
      </div>

      <Section title="Network and directory kept apart" icon="ti-shield-lock">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-[13px]">
          <i className="ti ti-shield-lock text-[#27500A]" aria-hidden="true" />
          <div className="min-w-0 flex-1"><div className="text-slate-800">iCFO network</div><div className="text-[12px] text-slate-500">{network.withEmail.toLocaleString("en-US")} with email · gated intros only</div></div>
          <Tag tone="ok">{network.total.toLocaleString("en-US")}</Tag>
        </div>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-[13px]">
          <i className="ti ti-world text-[#3C3489]" aria-hidden="true" />
          <div className="min-w-0 flex-1"><div className="text-slate-800">Investor directory</div><div className="text-[12px] text-slate-500">{stats.withEmail.toLocaleString("en-US")} with email · founders import directly</div></div>
          <Tag tone="pro">{stats.published.toLocaleString("en-US")}</Tag>
        </div>
        <p className="px-4 py-3 text-[12.5px] text-slate-600">
          Directory rows never enter network matching or gated intros. Network investors never appear in the founder directory: {stats.hiddenAsNetwork.toLocaleString("en-US")} directory {stats.hiddenAsNetwork === 1 ? "record matches" : "records match"} a network email and {stats.hiddenAsNetwork === 1 ? "is" : "are"} hidden from founders.
        </p>
      </Section>

      <Section title="Latest imports" icon="ti-file-import" action={<Link href="/admin/investor-directory/imports" className="text-[12.5px] text-[#1A6CE4]">All imports →</Link>}>
        {imports.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">No imports yet.</p> : imports.slice(0, 4).map((i) => (
          <div key={i.id} className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-[13px] first:border-t-0">
            <div className="min-w-0 flex-1"><div className="text-slate-800">{i.name}</div><div className="text-[12px] text-slate-500">{i.row_count.toLocaleString("en-US")} rows · {i.created_count.toLocaleString("en-US")} new · {i.merged_count.toLocaleString("en-US")} merged</div></div>
            <Tag tone={i.status === "published" ? "ok" : "warn"}>{i.status === "published" ? "Published" : "Verifying"}</Tag>
          </div>
        ))}
      </Section>
    </div>
  );
}
