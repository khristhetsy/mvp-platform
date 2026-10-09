import { requireRole } from "@/lib/supabase/auth";
import { DirectoryRecordsList } from "@/components/admin/investor-directory/DirectoryRecordsList";
import { PAGE_SIZE, allSources, listRecords, loadSettings } from "@/lib/investor-directory/db";
import { staleCutoff } from "@/lib/investor-directory/limits";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; status?: string; verification?: string; source?: string; importId?: string; page?: string }>;

export default async function InvestorDirectoryRecordsPage({ searchParams }: Readonly<{ searchParams: SP }>) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const settings = await loadSettings();
  const [list, sources] = await Promise.all([
    listRecords({ q: sp.q, status: sp.status, verification: sp.verification, source: sp.source, importId: sp.importId, page: Number(sp.page ?? 1) || 1 }, settings),
    allSources(),
  ]);
  return (
    <div className="space-y-3 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-900">Records</h1>
      {sp.importId ? <p className="text-[12.5px] text-slate-500">Showing one import. Clear the filters to see every record.</p> : null}
      <DirectoryRecordsList
        mode="records"
        rows={list.rows}
        total={list.total}
        page={list.page}
        pageSize={PAGE_SIZE}
        sources={sources}
        staleBefore={staleCutoff(settings.stale_days)}
        initial={{ q: sp.q ?? "", status: sp.status ?? "", verification: sp.verification ?? "", source: sp.source ?? "" }}
      />
    </div>
  );
}
