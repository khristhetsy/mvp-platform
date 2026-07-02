import type { FounderOutreachAdminSummary } from "@/lib/founder-crm/admin-outreach-summary";
import { useTranslations } from "next-intl";

export function AdminFounderOutreachSummary({
  summary,
}: Readonly<{ summary: FounderOutreachAdminSummary }>) {
  const t = useTranslations("sharedCmp");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{t("founder_outreach_aggregate")}</h2>
      <p className="mt-1 text-sm text-slate-500">
        Compliance-safe metadata only — private contact details are not shown to admins.
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Private contacts</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary.privateContactCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Outreach targets</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary.outreachTargetCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Draft campaigns</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary.draftCampaignCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Active/queued campaigns</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary.activeCampaignCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Queued messages</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary.queuedMessageCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Social drafts</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary.socialDraftCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Flagged social</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary.socialDraftFlaggedCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Copied social</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary.socialDraftCopiedCount}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-amber-800">
        Internal queue only — no external email delivery is enabled in this phase.
      </p>
    </div>
  );
}
