import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { MetricCard } from "@/components/MetricCard";
import { FounderAccessActions } from "@/components/admin/investor-directory/FounderAccessActions";
import { Section, Tag } from "@/components/admin/investor-directory/ui";
import { fmtPT, planLabel, type Tone } from "@/lib/investor-directory/format";
import { founderUsageDetail, loadSettings } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const FLAG: Record<string, { label: string; tone: Tone }> = {
  normal: { label: "Normal", tone: "ok" }, spike: { label: "Spike", tone: "warn" }, review: { label: "Review", tone: "bad" },
  paused: { label: "Paused", tone: "warn" }, suspended: { label: "Suspended", tone: "bad" },
};
const LOG = {
  sent: { icon: "ti-send", color: "#185FA5", verb: "To" },
  received: { icon: "ti-mail-down", color: "#27500A", verb: "From" },
  bounced: { icon: "ti-mail-x", color: "#A32D2D", verb: "To" },
} as const;

export default async function FounderUsagePage({ params }: Readonly<{ params: Promise<{ founderId: string }> }>) {
  await requireRole(["admin"]);
  const { founderId } = await params;
  const settings = await loadSettings();
  const d = await founderUsageDetail(founderId, settings);
  const u = d.usage;
  if (!u) notFound();
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}% of sent` : "No sends yet");
  const max = Math.max(1, ...d.perDay.map((x) => x.sent));
  const heldPct = u.holdLimit ? Math.min(100, Math.round((u.held / u.holdLimit) * 100)) : null;
  const emailPct = u.emailCap ? Math.min(100, Math.round((u.emailsUsed / u.emailCap) * 100)) : null;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Link href="/admin/investor-directory/usage" className="text-[12.5px] text-slate-500 hover:text-slate-700">← Founder usage</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold text-slate-900">{u.company ?? u.name}</h1>
        <Tag tone={FLAG[u.flag].tone}>{FLAG[u.flag].label}</Tag>
        <FounderAccessActions founderId={u.founderId} status={u.status} />
      </div>
      <p className="text-[12.5px] text-slate-500">{u.name}{u.email ? ` · ${u.email}` : ""} · {planLabel(u.plan, u.tier)} · last active {fmtPT(u.lastActive, true)}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:h-full">
        <MetricCard audience="admin" label="Contacts held" value={u.held.toLocaleString("en-US")} unit={`of ${u.holdLimit.toLocaleString("en-US")}`} detail="Directory contacts in this founder's list"
          ring={heldPct === null ? { percent: null, pending: true } : { percent: heldPct, center: `${heldPct}%` }} />
        <MetricCard audience="admin" label="Emails this period" value={u.emailsUsed.toLocaleString("en-US")} unit={`of ${u.emailCap.toLocaleString("en-US")}`}
          detail="Every Manual outreach email in the founder's current 30 day period"
          ring={emailPct === null ? { percent: null, pending: true } : { percent: emailPct, center: `${emailPct}%` }}
          flag={u.emailCap > 0 && u.emailsUsed >= u.emailCap ? { text: "At the cap: sends are held until the period resets", tone: "bad" }
            : u.emailCap > 0 && u.emailsUsed >= u.emailCap * 0.8 ? { text: `${(u.emailCap - u.emailsUsed).toLocaleString("en-US")} emails left this period`, tone: "warn" } : null} />
        <MetricCard audience="admin" label="Imported, 30 days" value={u.imports30d.toLocaleString("en-US")} detail={`${u.importsInWindow.toLocaleString("en-US")} in the last ${settings.spike_hours} hours`}
          flag={u.flag === "spike" ? { text: `Over ${settings.spike_imports.toLocaleString("en-US")} in ${settings.spike_hours} hours`, tone: "warn" } : null} />
        <MetricCard audience="admin" label="Emails sent" value={u.sent.toLocaleString("en-US")} detail={`${d.opened.toLocaleString("en-US")} opened · manual outreach`} />
        <MetricCard audience="admin" label="Replies received" value={u.replied.toLocaleString("en-US")} detail={pct(u.replied, u.sent)} />
        <MetricCard audience="admin" label="Bounced" value={u.bounced.toLocaleString("en-US")} detail={pct(u.bounced, u.sent)}
          flag={u.flag === "review" ? { text: `Above the ${settings.bounce_pause_pct}% limit`, tone: "bad" } : null} />
        <MetricCard audience="admin" label="Terms accepted" value={u.termsAcceptedAt ? fmtPT(u.termsAcceptedAt) : "Not yet"} detail={u.termsAcceptedAt ? fmtPT(u.termsAcceptedAt, true) : "Can't import until accepted"} />
      </div>

      <Section title="Emails sent per day, last 15 days (PT)" icon="ti-chart-bar">
        <div className="flex h-24 items-end gap-1 px-4 pb-2 pt-4">
          {d.perDay.map((x) => (
            <div key={x.day} title={`${x.day}: ${x.sent} sent`} className="flex-1 rounded-t bg-[#1A6CE4]" style={{ height: `${Math.max(2, Math.round((x.sent / max) * 80))}px` }} />
          ))}
        </div>
        <div className="flex justify-between px-4 pb-3 text-[11px] text-slate-400"><span>{d.perDay[0]?.day}</span><span>{d.perDay.at(-1)?.day}</span></div>
      </Section>

      <Section title="Email log" icon="ti-mail">
        {d.log.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">No emails yet.</p> : d.log.map((e, i) => (
          <div key={`${e.kind}-${e.at}-${i}`} className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-[13px] first:border-t-0">
            <i className={`ti ${LOG[e.kind].icon}`} style={{ color: LOG[e.kind].color }} aria-hidden="true" />
            <div className="min-w-0 flex-1"><div className="text-slate-800">{LOG[e.kind].verb} {e.name}</div><div className="text-[12px] text-slate-500">{e.kind === "received" ? "Received" : "Sent"} {fmtPT(e.at, true)}</div></div>
            <Tag tone={e.kind === "bounced" ? "bad" : e.kind === "received" ? "ok" : "info"}>{e.status}</Tag>
          </div>
        ))}
      </Section>

      <Section title="Directory activity" icon="ti-history">
        {d.events.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">No activity.</p> : d.events.map((e, i) => (
          <div key={`${e.created_at}-${i}`} className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[12.5px] first:border-t-0">
            <span className="w-40 shrink-0 text-slate-500">{fmtPT(e.created_at, true)}</span>
            <span className="text-slate-800">{e.kind.replace("_", " ")}{e.count ? ` · ${e.count.toLocaleString("en-US")}` : ""}{e.detail ? ` · ${e.detail}` : ""}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}
