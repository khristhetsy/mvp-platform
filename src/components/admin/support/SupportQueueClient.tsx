"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SupportCareSettings } from "@/lib/support/settings";
import type { SupportAiTriage, SupportChannel } from "@/lib/support/support";
import { dueLabel } from "@/lib/support/business-hours";
import { SupportSettingsPanel } from "./SupportSettingsPanel";
import { SupportTicketView } from "./SupportTicketView";

export type QueueRow = {
  id: string;
  subject: string;
  status: string;
  source: string;
  channel: SupportChannel;
  priority: string;
  contextStage: string | null;
  contextItem: string | null;
  companyId: string;
  companyName: string;
  founderName: string;
  assignedTo: string | null;
  assigneeName: string | null;
  csat: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  refNo: number | null;
  dueAt: string | null;
  aiTriage: SupportAiTriage | null;
  rating: number | null;
  reopenedCount: number;
  snippet: string;
  lastFrom: "founder" | "staff" | null;
};

export type StaffOption = { id: string; name: string };

export type SupportKpis = {
  oldestWaitMs: number | null;
  onTimePct: number | null;
  answeredCount: number;
  avgRating: number | null;
  ratedCount: number;
};

type ViewKey = "open" | "mine" | "unassigned" | "risk" | "waiting" | "resolved" | "ch_app" | "ch_email" | "ch_chat";

const CHANNEL_META: Record<SupportChannel, { label: string; icon: string }> = {
  app: { label: "In-app request", icon: "ti-message-circle" },
  email: { label: "Email", icon: "ti-mail" },
  chat: { label: "Chat handoff", icon: "ti-robot" },
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-50 text-amber-700",
  pending_founder: "bg-blue-50 text-blue-700",
  resolved: "bg-emerald-50 text-emerald-700",
};
export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  pending_founder: "Waiting on founder",
  resolved: "Resolved",
};

/** Late or close to it: past the promised reply time, due within 2 hours, or 24h+ with no promise. */
export function isAtRisk(r: Pick<QueueRow, "status" | "dueAt" | "createdAt">, now = Date.now()): boolean {
  if (r.status !== "open") return false;
  if (r.dueAt) return new Date(r.dueAt).getTime() - now < 2 * 60 * 60 * 1000;
  return now - new Date(r.createdAt).getTime() >= 24 * 60 * 60 * 1000;
}

function ageText(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

function spanText(ms: number | null): string {
  if (ms === null) return "None";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m`;
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function SupportQueueClient({
  rows,
  staff,
  currentStaffId,
  settings,
  canEditSettings = false,
  kpis,
}: Readonly<{
  rows: QueueRow[];
  staff: StaffOption[];
  currentStaffId: string;
  settings: SupportCareSettings;
  canEditSettings?: boolean;
  kpis: SupportKpis;
}>) {
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<ViewKey>("open");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"oldest" | "newest" | "due">("due");
  const [gearOpen, setGearOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("request"));
  const gearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gearOpen) return;
    const close = (e: MouseEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [gearOpen]);

  // Fixed per page load; router.refresh() after each action brings fresh rows.
  const [now] = useState(() => Date.now());
  const active = rows.filter((r) => r.status !== "resolved");
  const views: Array<{ key: ViewKey; label: string; icon: string; match: (r: QueueRow) => boolean; tone?: string }> = [
    { key: "open", label: "Open", icon: "ti-inbox", match: (r) => r.status !== "resolved" },
    { key: "mine", label: "Mine", icon: "ti-user", match: (r) => r.status !== "resolved" && r.assignedTo === currentStaffId },
    { key: "unassigned", label: "Unassigned", icon: "ti-user-question", match: (r) => r.status !== "resolved" && !r.assignedTo },
    { key: "risk", label: "At risk or late", icon: "ti-alert-triangle", match: (r) => isAtRisk(r, now), tone: "text-red-600" },
    { key: "waiting", label: "Waiting on founder", icon: "ti-hourglass", match: (r) => r.status === "pending_founder" },
    { key: "resolved", label: "Resolved", icon: "ti-circle-check", match: (r) => r.status === "resolved" },
  ];
  const channelViews: Array<{ key: ViewKey; channel: SupportChannel }> = [
    { key: "ch_app", channel: "app" },
    { key: "ch_email", channel: "email" },
    { key: "ch_chat", channel: "chat" },
  ];
  const matcher = (key: ViewKey): ((r: QueueRow) => boolean) => {
    const v = views.find((x) => x.key === key);
    if (v) return v.match;
    const ch = channelViews.find((x) => x.key === key)?.channel;
    return (r) => r.status !== "resolved" && r.channel === ch;
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = matcher(view);
    const filtered = rows.filter((r) => {
      if (q) {
        const hay = `${r.subject} ${r.companyName} ${r.founderName} ${r.refNo ?? ""} ${r.snippet}`.toLowerCase();
        if (!hay.includes(q.replace(/^#/, ""))) return false;
        // A search looks across everything, resolved included.
        return true;
      }
      return match(r);
    });
    const t = (s: string | null) => (s ? new Date(s).getTime() : Number.POSITIVE_INFINITY);
    return [...filtered].sort((a, b) => {
      if (view === "resolved") return t(b.resolvedAt) - t(a.resolvedAt);
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      // Due first: top priority, then the soonest promised reply, then oldest.
      const pa = a.priority === "high" ? 0 : 1;
      const pb = b.priority === "high" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (t(a.dueAt) !== t(b.dueAt)) return t(a.dueAt) - t(b.dueAt);
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matcher is derived from rows/view
  }, [rows, view, query, sort]);

  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  function pick(id: string) {
    setSelectedId(id);
    const q = new URLSearchParams(params.toString());
    q.set("request", id);
    q.delete("resolved");
    window.history.replaceState(null, "", `/admin/support?${q.toString()}`);
  }

  return (
    <div className="space-y-3">
      {/* Desk numbers */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Open" value={String(active.length)} sub={`${active.filter((r) => isAtRisk(r, now)).length} at risk or late`} />
        <Kpi label="Oldest wait" value={spanText(kpis.oldestWaitMs)} sub="Oldest open request" />
        <Kpi
          label="Replied on time"
          value={kpis.onTimePct === null ? "No data" : `${kpis.onTimePct}%`}
          sub={`${kpis.answeredCount} first replies, 90 days`}
        />
        <Kpi
          label="Satisfaction"
          value={kpis.avgRating === null ? "No ratings" : `${kpis.avgRating} / 5`}
          sub={`${kpis.ratedCount} ratings, 90 days`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,330px)_minmax(0,1fr)]">
        {/* Views */}
        <nav className="rounded-xl border border-slate-200 bg-white p-2 text-sm" aria-label="Support views">
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Views</p>
          {views.map((v) => (
            <ViewButton key={v.key} active={view === v.key && !query} icon={v.icon} label={v.label} count={rows.filter(v.match).length} tone={v.tone} onClick={() => { setView(v.key); setQuery(""); }} />
          ))}
          <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Channels</p>
          {channelViews.map((c) => (
            <ViewButton
              key={c.key}
              active={view === c.key && !query}
              icon={CHANNEL_META[c.channel].icon}
              label={CHANNEL_META[c.channel].label}
              count={rows.filter(matcher(c.key)).length}
              onClick={() => { setView(c.key); setQuery(""); }}
            />
          ))}
          <div className="mt-3 border-t border-slate-100 pt-2">
            <a href="/admin/support/log" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              <i className="ti ti-list-details" aria-hidden="true" /> Support log
            </a>
          </div>
        </nav>

        {/* Ticket list */}
        <div className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-2">
            <div className="relative flex-1">
              <i className="ti ti-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search subject, company, founder, #ref"
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-xs focus:border-indigo-400 focus:outline-none"
                aria-label="Search support requests"
              />
            </div>
            <div className="relative" ref={gearRef}>
              <button
                type="button"
                onClick={() => setGearOpen((o) => !o)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                aria-label="Queue options"
                aria-expanded={gearOpen}
              >
                <i className="ti ti-settings text-base" aria-hidden="true" />
              </button>
              {gearOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-lg">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sort</p>
                  {([
                    ["due", "Due first"],
                    ["oldest", "Oldest first"],
                    ["newest", "Newest first"],
                  ] as const).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => { setSort(k); setGearOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-700 hover:bg-slate-50">
                      <i className={`ti ${sort === k ? "ti-check text-indigo-600" : "ti-point text-transparent"}`} aria-hidden="true" /> {label}
                    </button>
                  ))}
                  <div className="my-1 border-t border-slate-100" />
                  <button type="button" onClick={() => { setSettingsOpen(true); setGearOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-700 hover:bg-slate-50">
                    <i className="ti ti-bell" aria-hidden="true" /> Notifications and AI
                  </button>
                  <a href="/admin/support/log" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50">
                    <i className="ti ti-list-details" aria-hidden="true" /> Support log
                  </a>
                </div>
              ) : null}
            </div>
          </div>
          <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
            {list.length === 0 ? (
              <li className="p-6 text-center text-xs text-slate-500">{query ? "No requests match your search." : "Nothing here. Nice work."}</li>
            ) : (
              list.map((r) => <TicketCard key={r.id} r={r} active={selected?.id === r.id} onClick={() => pick(r.id)} />)
            )}
          </ul>
        </div>

        {/* Ticket */}
        <div className="min-w-0">
          {selected ? (
            <SupportTicketView
              key={selected.id}
              row={selected}
              staff={staff}
              currentStaffId={currentStaffId}
              aiDrafts={settings.ai.drafts}
              onChanged={() => router.refresh()}
            />
          ) : (
            <div className="flex h-full min-h-[560px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              Select a request to open the conversation.
            </div>
          )}
        </div>
      </div>

      {settingsOpen ? (
        <SupportSettingsPanel initial={settings} staff={staff} canEdit={canEditSettings} onClose={() => { setSettingsOpen(false); router.refresh(); }} />
      ) : null}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}

function ViewButton({ active, icon, label, count, tone, onClick }: { active: boolean; icon: string; label: string; count: number; tone?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${active ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-700 hover:bg-slate-50"}`}
    >
      <i className={`ti ${icon} text-sm ${active ? "" : tone ?? "text-slate-400"}`} aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-indigo-100" : "bg-slate-100 text-slate-500"}`}>{count}</span>
    </button>
  );
}

function TicketCard({ r, active, onClick }: { r: QueueRow; active: boolean; onClick: () => void }) {
  const due = r.status === "open" ? dueLabel(r.dueAt) : null;
  const risk = isAtRisk(r);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full border-l-2 px-3 py-2.5 text-left hover:bg-slate-50 ${active ? "border-indigo-500 bg-indigo-50/60" : "border-transparent"}`}
      >
        <div className="flex items-center gap-1.5">
          <i className={`ti ${CHANNEL_META[r.channel].icon} text-sm text-slate-400`} title={CHANNEL_META[r.channel].label} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">{r.subject}</span>
          <span className="shrink-0 text-[10px] text-slate-400">{ageText(r.createdAt)}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">
          {r.refNo ? `#${r.refNo} · ` : ""}{r.founderName} · {r.companyName}
        </p>
        {r.snippet ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
            {r.lastFrom === "staff" ? <span className="text-slate-400">You: </span> : null}
            {r.snippet}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {r.status !== "open" ? (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
          ) : null}
          {due ? (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${due.overdue ? "bg-red-50 text-red-700" : risk ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
              {due.overdue ? "Late" : due.text}
            </span>
          ) : risk ? (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">At risk</span>
          ) : null}
          {r.priority === "high" && r.status !== "resolved" ? (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">High</span>
          ) : null}
          {r.contextItem || r.aiTriage?.topic ? (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{r.contextItem ?? r.aiTriage?.topic}</span>
          ) : null}
          {r.rating ? <span className="text-[10px] text-amber-500" title="Founder rating">{"★".repeat(r.rating)}</span> : null}
          <span className="ml-auto truncate text-[10px] text-slate-400">{r.assigneeName ?? "Unassigned"}</span>
        </div>
      </button>
    </li>
  );
}
