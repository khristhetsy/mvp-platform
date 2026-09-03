"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Activity log assembled from existing sources (the per-gate reminder state exposed
// by the gate-reminders API). No new table: each gate's reminder row is unrolled
// into events — sent, scheduled, resolved — merged and sorted newest-first, each
// row expandable for detail. Reach-out/override events would need an events table
// (deferred), so this covers reminder + gate activity.

type GateStatus = {
  gateKey: string;
  label: string;
  paused: boolean;
  sendsCount: number;
  lastSentAt: string | null;
  nextSendAt: string | null;
  resolvedAt: string | null;
  oneTime: boolean;
  subject: string;
};

type Kind = "sent" | "scheduled" | "resolved";
type Entry = {
  id: string;
  kind: Kind;
  label: string;
  ts: string;
  subject: string;
  sendsCount: number;
  nextSendAt: string | null;
  oneTime: boolean;
};

const KIND_META: Record<Kind, { icon: string; bg: string; fg: string; verb: string }> = {
  sent: { icon: "ti-robot", bg: "#E1F5EE", fg: "#0F6E56", verb: "Reminder sent" },
  scheduled: { icon: "ti-calendar-plus", bg: "#F4EEDA", fg: "#BA7517", verb: "Reminder scheduled" },
  resolved: { icon: "ti-circle-check", bg: "#E1F5EE", fg: "#1D9E75", verb: "Gate resolved" },
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export function CompanyActivityLog({ companyId }: Readonly<{ companyId: string }>) {
  const [gates, setGates] = useState<GateStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/gate-reminders`);
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.gates)) setGates(j.gates as GateStatus[]);
    } catch { /* best-effort */ } finally {
      setLoading(false);
    }
  }, [companyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state after mount
  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const g of gates) {
      if (g.resolvedAt) out.push({ id: `${g.gateKey}:resolved`, kind: "resolved", label: g.label, ts: g.resolvedAt, subject: g.subject, sendsCount: g.sendsCount, nextSendAt: null, oneTime: g.oneTime });
      if (g.lastSentAt) out.push({ id: `${g.gateKey}:sent`, kind: "sent", label: g.label, ts: g.lastSentAt, subject: g.subject, sendsCount: g.sendsCount, nextSendAt: g.nextSendAt, oneTime: g.oneTime });
      if (g.nextSendAt && !g.resolvedAt && !g.paused) out.push({ id: `${g.gateKey}:scheduled`, kind: "scheduled", label: g.label, ts: g.nextSendAt, subject: g.subject, sendsCount: g.sendsCount, nextSendAt: g.nextSendAt, oneTime: g.oneTime });
    }
    out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return filter === "all" ? out : out.filter((e) => e.kind === filter);
  }, [gates, filter]);

  const chip = (key: "all" | Kind, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(key)}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${filter === key ? "bg-slate-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {chip("all", "All")}
        {chip("sent", "Reminders sent")}
        {chip("scheduled", "Scheduled")}
        {chip("resolved", "Resolved")}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="px-4 py-6 text-xs text-slate-500">Loading activity…</p>
        ) : entries.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-500">No activity yet.</p>
        ) : (
          entries.map((e) => {
            const m = KIND_META[e.kind];
            const isOpen = !!open[e.id];
            return (
              <div key={e.id} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [e.id]: !o[e.id] }))}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-50"
                >
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full" style={{ background: m.bg, color: m.fg }}>
                    <i className={`ti ${m.icon} text-[13px]`} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium text-slate-800">{m.verb} · {e.label}</span>
                    <span className="block text-[11px] text-slate-400">{e.kind === "scheduled" ? (e.oneTime ? "one-time" : "automated") : e.kind === "sent" ? "automated · every 3 days" : "automatic"}</span>
                  </span>
                  <span className="flex-none text-[10.5px] text-slate-400">{fmt(e.ts)}</span>
                  <i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"} flex-none text-[15px] text-slate-400`} aria-hidden="true" />
                </button>
                {isOpen ? (
                  <div className="bg-slate-50 px-3.5 py-3 pl-12 text-[11.5px] text-slate-600">
                    <div className="text-[11px] text-slate-400">Subject</div>
                    <div className="mb-2 text-slate-800">{e.subject}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>Reminders sent: {e.sendsCount}</span>
                      {e.nextSendAt ? <span>Next: {fmt(e.nextSendAt)}</span> : null}
                      <span>Gate: {e.label}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
