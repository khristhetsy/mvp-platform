"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { TRACTION_PERIODS, type AgentTraction, type Placement, type SourceShare, type Traction, type TractionPeriod } from "@/lib/ir-agent/traction";

const CHANNEL_COLOR: Record<string, string> = {
  LinkedIn: "#1A6CE4",
  Email: "#0F9D58",
  Event: "#8E44AD",
  "Social media": "#E0527A",
  Website: "#F5A623",
  Direct: "#7A869F",
  Other: "#B8C2D6",
};

const pill = "rounded-lg px-4 py-2 text-sm font-medium";

function initials(name: string): string {
  return name.split(/[\s,&]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

/** Up or down arrow with the percent. Null means the previous period had none, so no percent is shown. */
function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500" title="No conversations in the previous period to compare with">New</span>;
  if (pct === 0) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">0.0%</span>;
  const up = pct > 0;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`} aria-label={`${up ? "Up" : "Down"} ${Math.abs(pct)} percent`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function SourceBars({ sources }: { sources: SourceShare[] }) {
  const shown = sources.filter((s) => s.count > 0);
  if (!shown.length) return <p className="text-sm text-slate-500">No conversations in this period.</p>;
  return (
    <ul className="space-y-1.5">
      {shown.map((s) => (
        <li key={s.channel} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-sm">
          <span className="text-slate-700">{s.channel}</span>
          <span className="h-2 overflow-hidden rounded-full bg-slate-100">
            <span className="block h-full rounded-full" style={{ width: `${s.share}%`, background: CHANNEL_COLOR[s.channel] }} />
          </span>
          <span className="flex items-center gap-2">
            <b className="text-slate-900">{s.share.toFixed(0)}%</b>
            <Change pct={s.changePct} />
          </span>
        </li>
      ))}
    </ul>
  );
}

const STATUS_STYLE: Record<Placement["status"], string> = {
  Published: "bg-emerald-50 text-emerald-700",
  Scheduled: "bg-amber-50 text-amber-800",
  Failed: "bg-red-50 text-red-700",
  Skipped: "bg-slate-100 text-slate-600",
  Draft: "bg-slate-100 text-slate-600",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center" title={hint}>
      <b className="block text-lg text-slate-900">{value}</b>
      <span className="text-[11.5px] text-slate-500">{label}</span>
    </div>
  );
}

function Posted({ items }: { items: Placement[] }) {
  if (!items.length) return <p className="text-sm text-slate-500">No social post carries this agent link yet. Emails and other links show under the source breakdown above.</p>;
  return (
    <ul className="space-y-2">
      {items.map((p, i) => (
        <li key={`${p.postId}:${p.network}:${i}`} className="rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#0A1A40] px-2 py-0.5 text-[11.5px] font-bold text-white">{p.network}</span>
            <span className="min-w-[120px] flex-1 text-sm font-semibold text-slate-900">{p.title}</span>
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#c9dcfb] bg-[#f5f9ff] px-2.5 py-1 text-xs font-semibold text-[#1A6CE4] hover:underline">View on {p.network}</a>
            ) : (
              <span className="text-xs text-slate-500">{p.status === "Failed" ? "Did not go out" : "Link after publish"}</span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[p.status]}`}>{p.status}</span>
            {p.when ? <span>{new Date(p.when).toLocaleString()}</span> : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Row({ a, rank, open, onToggle }: { a: AgentTraction; rank: number; open: boolean; onToggle: () => void }) {
  const top = a.sources.find((s) => s.count > 0);
  return (
    <li className="border-t border-slate-100 first:border-t-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 py-3 text-left">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-[#0A1A40]">{rank}</span>
        {a.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.imageUrl} alt={`Photo of the ${a.name} agent`} className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A1A40] text-xs font-semibold text-white">{initials(a.name)}</span>
        )}
        <span className="min-w-[140px] flex-1">
          <span className="block font-semibold text-slate-900">{a.name}</span>
          <span className="block text-xs text-slate-500">{a.companyName}</span>
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{a.department}</span>
        <span className="text-xs text-slate-500">{top ? `Top source: ${top.channel}` : "No source yet"}</span>
        <span className="ml-auto flex items-center gap-2">
          <b className="text-lg text-slate-900">{a.current.toLocaleString("en-US")}</b>
          <Change pct={a.changePct} />
        </span>
      </button>
      {open ? (
        <div className="mb-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Views" value={a.views === null ? "Not recorded" : a.views.toLocaleString("en-US")} hint="Visitor sessions that opened the agent page" />
            <Stat label="Chats started" value={a.current.toLocaleString("en-US")} hint="Visitors who sent the agent a message" />
            <Stat label="Meetings booked" value={a.booked.toLocaleString("en-US")} />
            <Stat label="View to chat" value={a.views && a.views > 0 ? `${((a.current / a.views) * 100).toFixed(1)}%` : "Not available"} hint="Chats started divided by views" />
          </div>
          {a.views !== null && a.viewsChangePct !== null ? (
            <p className="flex items-center gap-2 text-xs text-slate-500">Views against the previous period <Change pct={a.viewsChangePct} /></p>
          ) : null}
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-800">Where {a.name} chats come from</p>
            <SourceBars sources={a.sources} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-800">Where it was posted</p>
            <Posted items={a.placements} />
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * The Traction tab: which AI Agents start the most conversations, which
 * department owns them, how that moved against the previous period, and where
 * the visitors came from. Counts conversations, the one thing recorded today.
 */
export function AdminAgentTraction() {
  const [days, setDays] = useState<TractionPeriod>(30);
  const [dept, setDept] = useState("All");
  const [data, setData] = useState<{ traction: Traction; truncated: boolean; generatedAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (period: TractionPeriod) => {
    const res = await fetch(`/api/admin/ir-agent/traction?days=${period}`, { cache: "no-store" });
    const j = (await res.json().catch(() => ({}))) as { traction?: Traction; truncated?: boolean; generatedAt?: string; error?: string };
    if (!res.ok || !j.traction) {
      setError(j.error ?? "Could not load agent traction.");
      return;
    }
    setError(null);
    setData({ traction: j.traction, truncated: Boolean(j.truncated), generatedAt: j.generatedAt ?? new Date().toISOString() });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount and when the period changes
    void load(days);
  }, [days, load]);

  const t = data?.traction ?? null;
  const departments = useMemo(() => (t ? t.departments.map((d) => d.department) : []), [t]);
  const agents = useMemo(() => (t ? t.agents.filter((a) => dept === "All" || a.department === dept) : []), [t, dept]);
  const view = useMemo(() => {
    if (!t) return null;
    const current = agents.reduce((s, a) => s + a.current, 0);
    const previous = agents.reduce((s, a) => s + a.previous, 0);
    const pct = previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
    const leader = agents[0] && agents[0].current > 0 ? agents[0] : null;
    const growing = [...agents].filter((a) => a.changePct !== null && a.current > 0).sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0] ?? null;
    return { current, previous, pct, leader, growing, declining: agents.filter((a) => (a.changePct ?? 0) < 0).length };
  }, [t, agents]);

  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>;
  if (!t || !view) return <p className="py-6 text-sm text-slate-500">Loading agent traction.</p>;

  const { generatedAt, truncated } = data as { generatedAt: string; truncated: boolean };
  const maxDept = Math.max(1, ...t.departments.map((d) => d.current));
  const updated = new Date(generatedAt).toLocaleString();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white" role="group" aria-label="Period">
          {TRACTION_PERIODS.map((p) => (
            <button key={p} type="button" onClick={() => setDays(p)} aria-pressed={days === p} className={`${pill} ${days === p ? "bg-[#EEF4FF] font-semibold text-[#1A6CE4]" : "text-slate-600 hover:text-slate-900"}`}>
              {p} days
            </button>
          ))}
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
          <option value="All">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Conversations"
          value={view.current.toLocaleString("en-US")}
          detail={`Started by visitors in the last ${days} days, ${view.previous.toLocaleString("en-US")} in the ${days} days before`}
          trend={view.pct === null ? "flat" : view.pct > 0 ? "up" : view.pct < 0 ? "down" : "flat"}
          flag={view.pct === null ? null : { text: `${view.pct > 0 ? "Up" : view.pct < 0 ? "Down" : "Flat"} ${Math.abs(view.pct).toFixed(1)}% on the previous period`, tone: view.pct >= 0 ? "good" : "warn" }}
          lastUpdated={generatedAt}
          audience="admin"
        />
        <MetricCard label="Most conversations" value={view.leader?.name ?? "None yet"} detail={view.leader ? `${view.leader.current.toLocaleString("en-US")} conversations, ${view.leader.department}` : "No agent has started a conversation in this period"} audience="admin" />
        <MetricCard
          label="Fastest growing"
          value={view.growing?.name ?? "None yet"}
          detail={view.growing ? `${view.growing.department}, ${view.growing.current.toLocaleString("en-US")} now against ${view.growing.previous.toLocaleString("en-US")} before` : "Needs conversations in both periods"}
          trend={view.growing && (view.growing.changePct ?? 0) > 0 ? "up" : "flat"}
          audience="admin"
        />
        <MetricCard label="Agents declining" value={String(view.declining)} detail={`Of ${agents.length} agents in view, fewer conversations than the previous period`} audience="admin" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Agent leaderboard</h2>
          <p className="mb-2 text-sm text-slate-500">Ranked by conversations. The arrow compares with the previous {days} days. Open an agent to see its views, sources and where it was posted.</p>
          {agents.length ? (
            <ul>
              {agents.map((a, i) => (
                <Row key={a.id} a={a} rank={i + 1} open={openId === a.id} onToggle={() => setOpenId(openId === a.id ? null : a.id)} />
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-slate-500">No agents in this department yet.</p>
          )}
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">By department</h2>
            <p className="mb-2 text-sm text-slate-500">Department is the agent type. Change is against the previous period.</p>
            <ul className="space-y-3">
              {t.departments.map((d) => (
                <li key={d.department}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-800">{d.department} <span className="font-normal text-slate-500">{d.agents} {d.agents === 1 ? "agent" : "agents"}</span></span>
                    <span className="flex items-center gap-2"><b>{d.current.toLocaleString("en-US")}</b><Change pct={d.changePct} /></span>
                  </div>
                  <span className="block h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-[#1A6CE4]" style={{ width: `${(d.current / maxDept) * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">Where conversations come from</h2>
            <p className="mb-2 text-sm text-slate-500">All agents in the {days} day period.</p>
            <SourceBars sources={t.sources} />
          </section>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        A conversation is one visitor session with an agent. Views count visitor sessions that opened the agent page, and start when the view tracking SQL is run. Change is (this period minus the previous period) divided by the previous period.
        Source comes from the link tag that opened the agent, and a visit with no tag counts as Direct. Updated {updated}.
        {truncated ? " More conversations exist than this view reads, so the figures are partial." : ""}
      </p>
    </div>
  );
}
