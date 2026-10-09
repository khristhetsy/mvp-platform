import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { Tag } from "@/components/admin/investor-directory/ui";
import { fmtPT, planLabel, type Tone } from "@/lib/investor-directory/format";
import { listUsage, loadSettings } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const FLAG: Record<string, { label: string; tone: Tone }> = {
  normal: { label: "Normal", tone: "ok" }, spike: { label: "Spike", tone: "warn" }, review: { label: "Review", tone: "bad" },
  paused: { label: "Paused", tone: "warn" }, suspended: { label: "Suspended", tone: "bad" },
};

const n = (v: number) => v.toLocaleString("en-US");
/** Founder usage, last 30 days (PT). Click a founder for sends, replies, bounces and the email log. */
export default async function InvestorDirectoryUsagePage() {
  await requireRole(["admin"]);
  const settings = await loadSettings();
  const rows = await listUsage(settings);
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Founder usage</h1>
        <p className="mt-1 text-[12.5px] text-slate-500">Last 30 days, Pacific time. Spike: over {settings.spike_imports.toLocaleString("en-US")} imports in {settings.spike_hours} hours. Review: bounce rate over {settings.bounce_pause_pct}% once {settings.bounce_min_sends} emails are sent. Emails count every Manual outreach email in the founder&apos;s current 30 day period.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? <p className="px-4 py-12 text-center text-sm text-slate-500">No founder has used the directory yet.</p> : rows.map((u) => (
          <Link key={u.founderId} href={`/admin/investor-directory/usage/${u.founderId}`} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-[13px] last:border-0 hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <div className="text-slate-900">{u.company ?? u.name}</div>
              <div className="text-[12px] text-slate-500">
                {planLabel(u.plan, u.tier)} · {n(u.held)} / {n(u.holdLimit)} contacts · {n(u.emailsUsed)} / {n(u.emailCap)} emails this period · {n(u.imports30d)} imports · last active {fmtPT(u.lastActive, true)}
              </div>
            </div>
            {u.emailCap > 0 && u.emailsUsed >= u.emailCap ? <Tag tone="bad">At email cap</Tag>
              : u.emailCap > 0 && u.emailsUsed >= u.emailCap * 0.8 ? <Tag tone="warn">Near email cap</Tag> : null}
            <Tag tone={FLAG[u.flag].tone}>{FLAG[u.flag].label}</Tag>
            <i className="ti ti-chevron-right text-slate-400" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
