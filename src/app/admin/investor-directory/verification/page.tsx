import { requireRole } from "@/lib/supabase/auth";
import { DirectoryRecordsList } from "@/components/admin/investor-directory/DirectoryRecordsList";
import { PAGE_SIZE, allSources, listRecords, loadSettings } from "@/lib/investor-directory/db";
import { staleCutoff } from "@/lib/investor-directory/limits";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; verification?: string; source?: string; page?: string }>;

/** Unverified, missing industries, bounced, and stale records, oldest first. */
export default async function InvestorDirectoryVerificationPage({ searchParams }: Readonly<{ searchParams: SP }>) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const settings = await loadSettings();
  const [list, sources] = await Promise.all([
    listRecords({ q: sp.q, verification: sp.verification, source: sp.source, queue: !sp.verification, page: Number(sp.page ?? 1) || 1 }, settings),
    allSources(),
  ]);
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Verification queue</h1>
        <p className="mt-1 text-[12.5px] text-slate-500">Open a record, check it against the fund&apos;s website, fill industries, then Save and mark verified. Bounces from founder sends land here (gear › Check bounces).</p>
      </div>
      <DirectoryRecordsList
        mode="verification"
        rows={list.rows}
        total={list.total}
        page={list.page}
        pageSize={PAGE_SIZE}
        sources={sources}
        staleBefore={staleCutoff(settings.stale_days)}
        initial={{ q: sp.q ?? "", status: "", verification: sp.verification ?? "", source: sp.source ?? "" }}
      />
    </div>
  );
}
