"use client";

/**
 * Project record — the Odoo project form, filled from the IR Hub. Opened from a Projects card.
 *   control bar   New · breadcrumb · smart buttons (Tasks / Pipeline / Meetings / Founder report) · record pager
 *   sheet         Share Project · month/week stage bar (current week lit) · status · title · field grid ·
 *                 Description / Settings / Analytics tabs
 *   chatter       Send message · Log note · followers · dated history (messages, notes, activities, stage moves, reports)
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EntrepreneurProfile } from "@/lib/ir/db";
import type { MetricCounts } from "@/lib/ir/metrics";
import { IR_PROJECT_STATUSES, type IrMilestone, type IrProject, type IrProjectStatus } from "@/lib/ir/types";
import type { FeedItem, ProjectFormAnalytics } from "@/app/api/admin/ir/projects/[id]/form/route";

type Payload = {
  project: IrProject; milestones: IrMilestone[]; staff: Array<{ id: string; name: string }>; entrepreneur: EntrepreneurProfile | null; analytics: ProjectFormAnalytics;
  followers: Array<{ id: string; name: string }>;
  counts: { tasksTotal: number; tasksDone: number; matches: number; meetingsHeld: number; lastReport: { kind: string; end: string; at: string } | null };
  siblings: { index: number; total: number; prev: string | null; next: string | null };
  feed: FeedItem[];
};
type Tab = "description" | "settings" | "analytics";
const STATUS_LABEL: Record<IrProjectStatus, string> = { active: "Active", paused: "On hold", completed: "Completed", cancelled: "Cancelled" };
const inp = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:border-indigo-400 focus:outline-none";
const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50";
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtAt = (ts: string) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const dayOf = (ts: string) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const METRICS: Array<{ key: keyof MetricCounts; label: string }> = [{ key: "intros", label: "Intros sent" }, { key: "emails", label: "Emails" }, { key: "calls", label: "Calls" }, { key: "contacted", label: "Contacted" }, { key: "meetings_booked", label: "Meetings booked" }, { key: "meetings_held", label: "Meetings held" }, { key: "term_sheets", label: "Term sheets" }, { key: "commitments", label: "Commitments" }];

export function ProjectFormClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("description");
  const [busy, setBusy] = useState(false);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/ir/projects/${projectId}/form`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load the project."); return; }
    setData(j); setError(null);
  }, [projectId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    const r = await fetch(`/api/admin/ir/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "Couldn't save."); return; }
    await load();
  }

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const { project: p, milestones, counts, siblings, entrepreneur } = data;
  const base = `/admin/ir/projects/${projectId}`;
  const months = milestones.filter((m) => m.kind === "month").sort((a, b) => a.sort_order - b.sort_order);
  const weeks = milestones.filter((m) => m.kind === "week").sort((a, b) => a.sort_order - b.sort_order);
  const curWeek = weeks.find((w) => w.starts_on <= today && today <= w.ends_on) ?? (today < p.start_date ? weeks[0] : weeks[weeks.length - 1]) ?? null;
  const curMonth = curWeek ? months.find((m) => m.id === curWeek.parent_id) ?? null : null;
  const daysLeft = curWeek ? Math.max(0, Math.round((Date.parse(`${curWeek.ends_on}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000)) : 0;

  return (
    <div className="flex flex-col gap-3">
      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div> : null}

      {/* Control bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/ir/projects/new" className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">New</Link>
        <div className="min-w-0">
          <p className="text-[11.5px] text-slate-500"><Link href="/admin/ir/projects" className="hover:text-indigo-700">Projects</Link></p>
          <p className="truncate text-[13.5px] font-semibold text-slate-900">{p.title}{p.founder_name && p.founder_name !== p.title ? <span className="font-normal text-slate-500"> · {p.founder_name}</span> : null}</p>
        </div>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-200 bg-white text-[11.5px]">
          <Smart href={`${base}/tasks`} label="Tasks" value={`${counts.tasksDone} / ${counts.tasksTotal}${counts.tasksTotal ? ` · ${Math.round((counts.tasksDone / counts.tasksTotal) * 100)}%` : ""}`} />
          <Smart href={`${base}/pipeline`} label="Pipeline" value={`${counts.matches} match${counts.matches === 1 ? "" : "es"}`} />
          <Smart href={`${base}/pipeline`} label="Meetings" value={`${counts.meetingsHeld} held`} />
          <Smart href={`${base}/report`} label="Founder report" value={counts.lastReport ? `${counts.lastReport.kind} to ${fmtDay(counts.lastReport.end)}` : "Not sent yet"} />
        </div>
        <div className="flex items-center gap-1 text-[12.5px] text-slate-600">
          <button type="button" disabled={!siblings.prev} onClick={() => siblings.prev && router.push(`/admin/ir/projects/${siblings.prev}`)} className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40" aria-label="Previous project">‹</button>
          <span className="tabular-nums">{siblings.index + 1} / {siblings.total}</span>
          <button type="button" disabled={!siblings.next} onClick={() => siblings.next && router.push(`/admin/ir/projects/${siblings.next}`)} className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40" aria-label="Next project">›</button>
        </div>
      </div>

      {/* Sheet */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <Link href={`${base}/pipeline?add=1`} className="rounded-lg bg-violet-700 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-violet-800">Share Project</Link>
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
            {months.map((m) => {
              const isCur = curMonth?.id === m.id; const done = m.ends_on < today;
              return (
                <div key={m.id} className="flex items-center">
                  <Stage label={m.label} state={isCur ? "on" : done ? "done" : "todo"} href={`${base}/tasks`} />
                  {isCur ? weeks.filter((w) => w.parent_id === m.id).map((w) => <Stage key={w.id} label={w.label} hint={w.id === curWeek?.id ? `${daysLeft}d left` : undefined} state={w.id === curWeek?.id ? "on" : w.ends_on < today ? "done" : "todo"} href={`${base}/tasks`} />) : null}
                </div>
              );
            })}
          </div>
          <select value={p.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })} className={inp} aria-label="Status">{IR_PROJECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        </div>

        <div className="px-5 py-4">
          <h2 className="flex items-center gap-2 text-[22px] font-semibold text-slate-900">
            <button type="button" disabled={busy} onClick={() => patch({ starred: !p.starred })} className={`text-[20px] ${p.starred ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`} aria-label={p.starred ? "Unstar" : "Star"}>{p.starred ? "★" : "☆"}</button>
            {p.title}
          </h2>
          <div className="mt-3 grid gap-x-10 gap-y-2 text-[13px] sm:grid-cols-2">
            <Field label="Tasks"><span>{counts.tasksTotal} weekly task{counts.tasksTotal === 1 ? "" : "s"} · <Link href={`${base}/tasks`} className="text-indigo-700 hover:underline">open board</Link></span></Field>
            <Field label="Project manager"><select value={p.owner_id} disabled={busy} onChange={(e) => patch({ ownerId: e.target.value })} className={inp}>{data.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Tags"><span className="flex flex-wrap gap-1">{p.owner_name ? <Chip cls="bg-blue-50 text-blue-800">{p.owner_name}</Chip> : null}{p.is_spv ? <Chip cls="bg-rose-50 text-rose-700">SPV</Chip> : null}{entrepreneur?.portalPlan ? <Chip cls="bg-emerald-50 text-emerald-700">{entrepreneur.portalPlan}</Chip> : null}<Chip cls="bg-slate-100 text-slate-600">{STATUS_LABEL[p.status]}</Chip></span></Field>
            <Field label="Planned date"><span>{fmtDay(p.start_date)} → {fmtDay(p.end_date)} · {p.term_months} months</span></Field>
            <Field label="Company"><span>{entrepreneur?.companyId ? <Link href={`/admin/companies/${entrepreneur.companyId}`} className="text-indigo-700 hover:underline">{entrepreneur.company}</Link> : entrepreneur?.founderContactId ? <Link href={`/admin/sales/contacts/${entrepreneur.founderContactId}`} className="text-indigo-700 hover:underline">{entrepreneur.company}</Link> : entrepreneur?.company ?? "—"}{entrepreneur?.founder ? <span className="text-slate-500"> · {entrepreneur.founder}</span> : null}</span></Field>
            <Field label="Founder portal"><span>{p.founder_report_visible ? "On · founder sees stage counts and firms, never investor names" : "Off"}</span></Field>
          </div>

          <div className="mt-5 flex border-b border-slate-200 text-[12.5px]">
            {(["description", "settings", "analytics"] as Tab[]).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px px-3.5 py-2 ${tab === t ? "border-b-2 border-indigo-600 font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>{t === "description" ? "Description" : t === "settings" ? "Settings" : "Analytics"}</button>)}
          </div>
          {tab === "description" ? <Description value={p.description ?? ""} busy={busy} onSave={(v) => patch({ description: v || null })} /> : null}
          {tab === "settings" ? (
            <div className="grid gap-x-10 gap-y-2 py-4 text-[13px] sm:grid-cols-2">
              <Field label="Status"><select value={p.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })} className={inp}>{IR_PROJECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
              <Field label="Term"><span>{p.term_months} months · {milestones.filter((m) => m.kind === "week").length} weeks · ends {fmtDay(p.end_date)}</span></Field>
              <Field label="Founder portal"><Toggle on={p.founder_report_visible} busy={busy} onChange={(v) => patch({ founderReportVisible: v })} label="Founder can view the outreach report" /></Field>
              <Field label="SPV Program"><Toggle on={p.is_spv} busy={busy} onChange={(v) => patch({ isSpv: v })} label="SPV Program engagement" /></Field>
              <Field label="Weekly summary"><Toggle on={p.weekly_summary} busy={busy} onChange={(v) => patch({ weeklySummary: v })} label="Email the founder every Monday" /></Field>
              <Field label="Monthly summary"><Toggle on={p.monthly_summary} busy={busy} onChange={(v) => patch({ monthlySummary: v })} label="Email the founder when a month closes" /></Field>
            </div>
          ) : null}
          {tab === "analytics" ? (
            <table className="mt-3 w-full text-[12.5px]">
              <thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1.5 font-medium">Metric</th><th className="py-1.5 text-right font-medium">This week</th><th className="py-1.5 text-right font-medium">This month</th><th className="py-1.5 text-right font-medium">Whole term</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{METRICS.map((m) => <tr key={m.key}><td className="py-1.5 text-slate-800">{m.label}</td><td className="py-1.5 text-right tabular-nums">{data.analytics.week[m.key]}</td><td className="py-1.5 text-right tabular-nums">{data.analytics.month[m.key]}</td><td className="py-1.5 text-right tabular-nums">{data.analytics.term[m.key]}</td></tr>)}</tbody>
            </table>
          ) : null}
        </div>
      </div>

      {/* Chatter */}
      <Chatter projectId={projectId} followers={data.followers} feed={data.feed} onPosted={load} />
    </div>
  );
}

function Smart({ href, label, value }: { href: string; label: string; value: string }) {
  return <Link href={href} className="border-l border-slate-200 px-3 py-1.5 first:border-l-0 hover:bg-slate-50"><span className="block text-slate-500">{label}</span><span className="block font-medium text-slate-900">{value}</span></Link>;
}
function Stage({ label, hint, state, href }: { label: string; hint?: string; state: "on" | "done" | "todo"; href: string }) {
  const cls = state === "on" ? "bg-slate-900 text-white" : state === "done" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600";
  return <Link href={href} className={`-ml-1.5 whitespace-nowrap px-3.5 py-1.5 text-[12px] first:ml-0 ${cls}`} style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)" }}>{label}{hint ? <span className="ml-1 text-[10.5px] opacity-70">{hint}</span> : null}</Link>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[140px_1fr] items-center gap-2"><span className="text-[12.5px] font-medium text-slate-600">{label}</span><span className="min-w-0 text-slate-800">{children}</span></div>;
}
function Chip({ cls, children }: { cls: string; children: React.ReactNode }) { return <span className={`rounded-full px-2 py-0.5 text-[11px] ${cls}`}>{children}</span>; }
function Toggle({ on, busy, onChange, label }: { on: boolean; busy: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={on} disabled={busy} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}
function Description({ value, busy, onSave }: { value: string; busy: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const dirty = v !== value;
  return (
    <div className="py-3">
      <textarea value={v} onChange={(e) => setV(e.target.value)} rows={5} placeholder="Project description — raise summary, mandate, anything the team should know." className={`w-full ${inp}`} />
      {dirty ? <div className="mt-2 flex gap-2"><button type="button" disabled={busy} onClick={() => onSave(v.trim())} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Save</button><button type="button" onClick={() => setV(value)} className={btn}>Discard</button></div> : null}
    </div>
  );
}

function Chatter({ projectId, followers, feed, onPosted }: { projectId: string; followers: Array<{ id: string; name: string }>; feed: FeedItem[]; onPosted: () => Promise<void> }) {
  const [mode, setMode] = useState<"message" | "note" | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function post() {
    if (!mode) return;
    if (!body.trim()) { setErr("Write something first."); return; }
    setBusy(true); setErr(null); setOk(null);
    const r = await fetch(`/api/admin/ir/projects/${projectId}/form`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, body: body.trim() }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Couldn't post."); return; }
    setBody(""); setMode(null); setOk(mode === "message" ? `Sent — ${j.notified ?? 0} follower${j.notified === 1 ? "" : "s"} notified.` : "Note logged.");
    await onPosted();
  }
  const rows = feed.map((f, i) => ({ f, i, day: dayOf(f.at), showDay: i === 0 || dayOf(f.at) !== dayOf(feed[i - 1].at) }));
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMode(mode === "message" ? null : "message")} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${mode === "message" ? "bg-violet-800 text-white" : "bg-violet-700 text-white hover:bg-violet-800"}`}>Send message</button>
        <button type="button" onClick={() => setMode(mode === "note" ? null : "note")} className={`${btn} ${mode === "note" ? "ring-2 ring-indigo-300" : ""}`}>Log note</button>
        <span className="ml-auto text-[12px] text-slate-500" title={followers.map((f) => f.name).join(", ")}>👤 {followers.length} follower{followers.length === 1 ? "" : "s"}</span>
      </div>
      {mode ? (
        <div className="mt-3">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={mode === "message" ? "Message to followers — the project owner and task assignees get a notification." : "Internal note — kept on the project, no notification."} className={`w-full ${inp}`} />
          <div className="mt-2 flex items-center gap-3">{err ? <span className="text-[12px] text-rose-600">{err}</span> : null}<button type="button" disabled={busy} onClick={post} className="ml-auto rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Posting…" : mode === "message" ? "Send" : "Log"}</button></div>
        </div>
      ) : null}
      {ok ? <p className="mt-2 text-[12px] text-emerald-700">{ok}</p> : null}
      <div className="mt-2">
        {rows.map(({ f, i, day, showDay }) => {
          return (
            <div key={i}>
              {showDay ? <div className="relative my-3 text-center text-[11px] text-slate-400"><span className="relative z-10 bg-white px-3">{day}</span><span className="absolute inset-x-0 top-1/2 border-t border-slate-100" /></div> : null}
              <div className="flex gap-3 py-1.5 text-[12.5px]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10.5px] font-semibold text-white">{f.who.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0">
                  <p><span className="font-medium text-slate-900">{f.who}</span><span className="ml-2 text-[11px] text-slate-400">{fmtAt(f.at)}</span>{f.kind === "note" ? <span className="ml-2 rounded bg-amber-50 px-1.5 text-[10.5px] text-amber-800">note</span> : f.kind === "message" ? <span className="ml-2 rounded bg-violet-50 px-1.5 text-[10.5px] text-violet-800">message</span> : null}</p>
                  <p className="whitespace-pre-wrap text-slate-700">{f.kind === "stage" || f.kind === "report" ? "• " : ""}{f.href ? <Link href={f.href} className="hover:text-indigo-700">{f.text}</Link> : f.text}</p>
                </div>
              </div>
            </div>
          );
        })}
        {feed.length === 0 ? <p className="py-3 text-[12.5px] text-slate-400">Nothing on this project yet.</p> : null}
      </div>
    </div>
  );
}
