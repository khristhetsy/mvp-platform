"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { AGENT_TYPE_SPECS, isAdminOnlyType, isAgentType, type AgentType } from "@/lib/ir-agent/agent-types";
import type { AgentListItem } from "@/app/api/admin/ir-agent/agents/route";

type Filter = "active" | "archived" | "all";

const btn = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const COLS = "lg:grid lg:grid-cols-[minmax(160px,1.5fr)_minmax(130px,1.2fr)_minmax(140px,1.4fr)_minmax(180px,1.7fr)_78px_250px] lg:gap-x-4";

function initials(name: string): string {
  return name.split(/[\s,&]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function Photo({ a, size }: { a: AgentListItem; size: number }) {
  const style = { width: size, height: size };
  if (a.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.imageUrl} alt={`Photo of the ${a.name} agent`} style={style} className="shrink-0 rounded-full border border-slate-200 object-cover" />;
  }
  return (
    <span style={{ ...style, fontSize: Math.round(size / 3) }} title="No photo yet, initials shown" className="flex shrink-0 items-center justify-center rounded-full bg-[#0A1A40] font-semibold text-white">
      {initials(a.name)}
    </span>
  );
}

function ago(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString();
}

/**
 * The Agents tab: every AI Agent with its photo, who it is for, purpose,
 * description and features. View opens a summary, Edit opens it in Build,
 * Archive takes it offline, Delete removes it for good after a confirmation.
 */
export function AdminAgentsList({ onNew, onEdit, onRemoved }: { onNew: () => void; onEdit: (a: AgentListItem) => void; onRemoved: (a: AgentListItem) => void }) {
  const { toast } = useToast();
  const [agents, setAgents] = useState<AgentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [viewing, setViewing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ir-agent/agents", { cache: "no-store" });
    const j = (await res.json().catch(() => ({}))) as { agents?: AgentListItem[]; error?: string };
    if (!res.ok) setError(j.error ?? "Could not load agents.");
    else setAgents(j.agents ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const archive = async (a: AgentListItem) => {
    setBusy(a.id);
    try {
      const res = await fetch(`/api/admin/ir-agent/agents/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: a.archived ? "restore" : "archive" }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not update the agent.");
      toast({ title: a.archived ? "Agent restored" : "Agent archived", description: a.archived ? "It comes back as a draft. Go live again from Build." : "It is offline and hidden from Active.", variant: "success" });
      await load();
    } catch (e) {
      toast({ title: "Not changed", description: e instanceof Error ? e.message : "Could not update the agent.", variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (a: AgentListItem) => {
    setBusy(a.id);
    try {
      const res = await fetch(`/api/admin/ir-agent/agents/${a.id}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not delete the agent.");
      setConfirmDel(null);
      setViewing(null);
      onRemoved(a);
      toast({ title: "Agent deleted", variant: "success" });
      await load();
    } catch (e) {
      toast({ title: "Not deleted", description: e instanceof Error ? e.message : "Could not delete the agent.", variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>;
  if (!agents) return <div className="py-8 text-sm text-slate-500">Loading agents…</div>;

  const counts = { active: agents.filter((a) => !a.archived).length, archived: agents.filter((a) => a.archived).length, all: agents.length };
  const list = agents.filter((a) => (filter === "all" ? true : filter === "archived" ? a.archived : !a.archived));
  const typeOf = (a: AgentListItem): AgentType => (isAgentType(a.agentType) ? a.agentType : "founder");

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Agents</h2>
          <p className="mt-1 text-sm text-slate-600">Every AI Agent you have created. The photo comes from Branding in Build. Open an agent to view it, edit it, archive it or delete it.</p>
        </div>
        <button type="button" onClick={onNew} className="rounded-lg bg-[#1A6CE4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E78F5]">
          New AI Agent
        </button>
      </div>

      <div className="inline-flex overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="Filter agents">
        {(["active", "archived", "all"] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => { setFilter(f); setConfirmDel(null); }} className={`px-4 py-2 text-sm font-semibold ${filter === f ? "bg-[#E8EFFD] text-[#1b3f99]" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            {f === "active" ? "Active" : f === "archived" ? "Archived" : "All"} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className={`hidden bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 ${COLS}`}>
          <span>Agent</span>
          <span>Purpose</span>
          <span>Description</span>
          <span>Features</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {list.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">No agents here.</p> : null}
        {list.map((a) => {
          const t = typeOf(a);
          const spec = AGENT_TYPE_SPECS[t];
          const f = a.features;
          const status = a.archived ? { label: "Archived", cls: "bg-slate-100 text-slate-600" } : a.status === "live" ? { label: "Live", cls: "bg-emerald-50 text-emerald-700" } : a.status === "paused" ? { label: "Paused", cls: "bg-amber-100 text-amber-800" } : { label: "Draft", cls: "bg-amber-100 text-amber-800" };
          return (
            <div key={a.id}>
              <div className={`flex flex-col gap-3 border-t border-slate-100 px-4 py-4 text-sm ${a.archived ? "bg-slate-50 text-slate-600" : "bg-white"} ${COLS} lg:items-center`}>
                <div className="flex min-w-0 items-center gap-3">
                  <Photo a={a} size={48} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900">{a.name}</span>
                    <span className="block text-xs text-slate-500">{a.organizationId ? a.companyName : "No company yet"}</span>
                    {!a.imageUrl ? <span className="block text-xs text-amber-800">No photo yet</span> : null}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="mb-1 inline-block rounded-full bg-[#E8EFFD] px-2.5 py-0.5 text-xs font-semibold text-[#1b3f99]">{spec.label}{isAdminOnlyType(t) ? " · Admin" : ""}</span>
                  <p className="text-[13px] leading-snug text-slate-600">{spec.description.split(". Company details")[0]}</p>
                </div>
                <p className="min-w-0 text-[13px] leading-snug text-slate-600">{a.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{f.questions} questions</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{f.contactFields} contact fields</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${f.wired >= 4 ? "bg-emerald-50 text-emerald-700" : f.wired > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{f.wired} of {f.wiredTotal} fields wired</span>
                  {f.pdfs ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{f.pdfs} Train PDF{f.pdfs > 1 ? "s" : ""}</span> : null}
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${f.booking ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{f.booking ? "Booking on" : "No booking"}</span>
                  {f.conversations ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{f.conversations} conversations</span> : null}
                </div>
                <div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
                  <p className="mt-1 text-[11px] text-slate-500">{ago(a.updatedAt)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={btn} onClick={() => { setViewing(viewing === a.id ? null : a.id); setConfirmDel(null); }}>View</button>
                  <button type="button" className={`${btn} border-[#1A6CE4] text-[#1b3f99]`} onClick={() => onEdit(a)}>Edit</button>
                  <button type="button" className={btn} disabled={busy === a.id} onClick={() => void archive(a)}>{a.archived ? "Restore" : "Archive"}</button>
                  <button type="button" className={`${btn} border-red-200 text-red-700 hover:bg-red-50`} onClick={() => { setConfirmDel(confirmDel === a.id ? null : a.id); setViewing(null); }}>Delete</button>
                </div>
              </div>
              {confirmDel === a.id ? (
                <div className="flex flex-wrap items-center gap-3 border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
                  <p className="min-w-[240px] flex-1"><b>Delete {a.name}?</b> This removes the agent, its questions and its conversations. This cannot be undone. Archive it instead to keep the history.</p>
                  <button type="button" className={btn} onClick={() => setConfirmDel(null)}>Cancel</button>
                  <button type="button" disabled={busy === a.id} className="rounded-lg bg-red-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-red-800 disabled:opacity-50" onClick={() => void remove(a)}>Delete agent</button>
                </div>
              ) : null}
              {viewing === a.id ? (
                <div className="flex flex-wrap items-start gap-4 border-t border-slate-100 bg-[#F8FBFF] px-4 py-4 text-sm">
                  <div className="flex w-24 flex-col items-center gap-2">
                    <Photo a={a} size={88} />
                    <button type="button" onClick={() => onEdit(a)} className="text-xs text-[#1A6CE4] underline">{a.imageUrl ? "Change photo" : "Add photo"}</button>
                  </div>
                  <div className="min-w-[260px] flex-1 space-y-1.5 text-[13px] text-slate-600">
                    <p className="text-sm font-semibold text-slate-900">{a.name} · summary</p>
                    <p>Address: <span className="font-mono">{a.address}</span></p>
                    <p>Opening: {a.description || "Not set"}</p>
                    <p>First question: {a.firstQuestion ?? "No question is on"}</p>
                    <p>{a.organizationId ? `Wired to the Company profile of ${a.companyName}.` : "No company linked yet. It stays a Draft until a company in your account is linked."}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" className={`${btn} border-[#1A6CE4] text-[#1b3f99]`} onClick={() => onEdit(a)}>Edit</button>
                    <button type="button" className={btn} onClick={() => setViewing(null)}>Close</button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
