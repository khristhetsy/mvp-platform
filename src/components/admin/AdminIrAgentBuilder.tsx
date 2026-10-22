"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminAgentsList } from "@/components/admin/AdminAgentsList";
import { IrAgentStudio, type StudioTab } from "@/components/ir-agent/IrAgentStudio";
import type { AgentListItem } from "@/app/api/admin/ir-agent/agents/route";
import { useToast } from "@/components/ui/ToastProvider";

export type AgentCompany = { id: string; name: string; kind: "Company" | "SPV"; status: "draft" | "live" | "paused" | null };
export type StandaloneAgent = { id: string; name: string; status: "draft" | "live" | "paused" };

type PageTab = "agents" | StudioTab;
const PAGE_TABS: Array<{ id: PageTab; label: string }> = [
  { id: "agents", label: "Agents" },
  { id: "build", label: "Build" },
  { id: "train", label: "Train" },
  { id: "share", label: "Share" },
  { id: "conversations", label: "Conversations" },
];

type Choice = { kind: "none" } | { kind: "org"; id: string } | { kind: "agent"; id: string };
/** Contacts grouped by company. orgId is set when the company is in the account; null means a prospect that only exists in contacts. */
type ContactGroup = { key: string; company: string; orgId: string | null; orgName: string | null; website: string | null; country: string | null; contacts: Array<{ id: string; name: string; email: string | null }> };

const STATUS_LABEL = { draft: "Draft", live: "Live", paused: "Paused" } as const;
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1A6CE4] focus:ring-2 focus:ring-[#1A6CE4]/20";
const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

/**
 * Admin AI Agent. Step 1 picks the company two ways: search your contacts, or
 * choose from the list. Only one of the two shows a company: a company found by
 * search leaves the list blank. Contacts are grouped by company. A company in
 * the account loads its profile; a prospect that only exists in contacts starts
 * a Draft agent that cannot go live until a company is linked. Leaving both
 * blank offers a new AI Agent with no company.
 */
export function AdminIrAgentBuilder({
  companies,
  standalone: initialStandalone,
  initialOrgId,
  initialAgentId,
}: {
  companies: AgentCompany[];
  standalone: StandaloneAgent[];
  initialOrgId: string | null;
  initialAgentId: string | null;
}) {
  const { toast } = useToast();
  const [standalone, setStandalone] = useState(initialStandalone);
  const [choice, setChoice] = useState<Choice>(() =>
    initialOrgId && companies.some((c) => c.id === initialOrgId)
      ? { kind: "org", id: initialOrgId }
      : initialAgentId && initialStandalone.some((a) => a.id === initialAgentId)
        ? { kind: "agent", id: initialAgentId }
        : { kind: "none" },
  );
  // Opens on Agents, or on Build when a company or agent was linked to.
  const [tab, setTab] = useState<PageTab>(initialOrgId || initialAgentId ? "build" : "agents");
  // How the company was chosen. "search" leaves the list blank and shows the contact instead.
  const [via, setVia] = useState<"list" | "search">("list");
  const [picked, setPicked] = useState<ContactGroup | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ContactGroup[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState(false);
  const reqId = useRef(0);

  const setUrl = useCallback((c: Choice) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("org");
    url.searchParams.delete("agent");
    if (c.kind === "org") url.searchParams.set("org", c.id);
    if (c.kind === "agent") url.searchParams.set("agent", c.id);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const editAgent = (a: AgentListItem) => {
    setVia("list");
    setPicked(null);
    setQ("");
    setHits(null);
    const c: Choice = a.organizationId ? { kind: "org", id: a.organizationId } : { kind: "agent", id: a.id };
    if (c.kind === "agent") setStandalone((cur) => (cur.some((x) => x.id === a.id) ? cur : [...cur, { id: a.id, name: a.name, status: a.status }]));
    choose(c);
    setTab("build");
  };

  const newAgent = () => {
    setVia("list");
    setPicked(null);
    setQ("");
    setHits(null);
    choose({ kind: "none" });
    setTab("build");
  };

  const agentRemoved = (a: AgentListItem) => {
    setStandalone((cur) => cur.filter((x) => x.id !== a.id));
    if ((choice.kind === "agent" && choice.id === a.id) || (choice.kind === "org" && a.organizationId === choice.id)) {
      setVia("list");
      setPicked(null);
      choose({ kind: "none" });
    }
  };

  const choose = (c: Choice) => {
    setChoice(c);
    setUrl(c);
  };

  // Contact search, debounced.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setHits(null);
      return;
    }
    const id = ++reqId.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/ir-agent/contacts?q=${encodeURIComponent(text)}`, { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as { groups?: ContactGroup[] };
        if (id === reqId.current) setHits(res.ok ? (j.groups ?? []) : []);
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const activeAgent = choice.kind === "agent" ? standalone.find((a) => a.id === choice.id) ?? null : null;
  const activeOrg = choice.kind === "org" ? companies.find((c) => c.id === choice.id) ?? null : null;

  const pickGroup = async (g: ContactGroup) => {
    // A prospect from contacts: start (or reuse) a Draft agent named for the company, prefilled from the contact record.
    if (!g.orgId) {
      setLinking(true);
      try {
        const reuse = standalone.find((a) => a.name.trim().toLowerCase() === g.company.trim().toLowerCase());
        let agentId = reuse?.id ?? null;
        if (!agentId) {
          const res = await fetch("/api/admin/ir-agent/new", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: g.company.slice(0, 60), website: g.website ?? undefined, country: g.country ?? undefined }),
          });
          const j = (await res.json().catch(() => ({}))) as { agentId?: string; name?: string; error?: string };
          if (!res.ok || !j.agentId) throw new Error(j.error ?? "Could not start the agent.");
          agentId = j.agentId;
          setStandalone((cur) => [...cur, { id: j.agentId as string, name: j.name ?? g.company, status: "draft" }]);
        }
        setVia("search");
        setPicked(g);
        setQ("");
        setHits(null);
        choose({ kind: "agent", id: agentId });
      } catch (e) {
        toast({ title: "Not started", description: e instanceof Error ? e.message : "Could not start the agent.", variant: "error" });
      } finally {
        setLinking(false);
      }
      return;
    }
    // A company found by search while a company-less agent is open: link it.
    if (activeAgent) {
      setLinking(true);
      try {
        const res = await fetch(`/api/founder/ir-agent/link?agentId=${activeAgent.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: g.orgId }) });
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Could not link the company.");
        setStandalone((cur) => cur.filter((a) => a.id !== activeAgent.id));
        toast({ title: "Company linked", description: `${g.orgName ?? g.company} is now wired to ${activeAgent.name}.`, variant: "success" });
      } catch (e) {
        toast({ title: "Not linked", description: e instanceof Error ? e.message : "Could not link the company.", variant: "error" });
        setLinking(false);
        return;
      }
      setLinking(false);
    }
    setVia("search");
    setPicked(g);
    setQ("");
    setHits(null);
    choose({ kind: "org", id: g.orgId });
  };

  const clearSearchPick = () => {
    setVia("list");
    setPicked(null);
    choose({ kind: "none" });
  };

  const chooseFromList = (value: string) => {
    setVia("list");
    setPicked(null);
    setQ("");
    setHits(null);
    if (!value) return choose({ kind: "none" });
    const [kind, id] = value.split(":");
    choose(kind === "agent" ? { kind: "agent", id } : { kind: "org", id });
  };

  const createAgent = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/ir-agent/new", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
      const j = (await res.json().catch(() => ({}))) as { agentId?: string; name?: string; error?: string };
      if (!res.ok || !j.agentId) throw new Error(j.error ?? "Could not create the agent.");
      setStandalone((cur) => [...cur, { id: j.agentId as string, name: j.name ?? newName, status: "draft" }]);
      setNewName("");
      setVia("list");
      setPicked(null);
      choose({ kind: "agent", id: j.agentId });
    } catch (e) {
      toast({ title: "Not created", description: e instanceof Error ? e.message : "Could not create the agent.", variant: "error" });
    } finally {
      setCreating(false);
    }
  };

  const listValue = via === "search" ? "" : choice.kind === "org" ? `org:${choice.id}` : choice.kind === "agent" ? `agent:${choice.id}` : "";
  const blank = choice.kind === "none";
  const viaSearch = via === "search" && picked !== null && choice.kind !== "none";
  const sorted = useMemo(() => companies, [companies]);

  const workingOn = activeOrg?.name ?? activeAgent?.name ?? null;

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5" aria-label="AI Agent sections" role="tablist">
        {PAGE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-[40px] rounded-lg px-5 text-sm font-medium ${tab === t.id ? "bg-slate-100 font-semibold text-[#0A1A40]" : "text-slate-600 hover:text-slate-900"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "agents" ? <AdminAgentsList onNew={newAgent} onEdit={editAgent} onRemoved={agentRemoved} /> : null}

      {tab !== "agents" && tab !== "build" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          {workingOn ? (
            <>
              <span className="text-slate-600">Working on</span>
              <span className="font-semibold text-slate-900">{workingOn}</span>
              <button type="button" onClick={() => setTab("build")} className={btn}>Change in Build</button>
            </>
          ) : (
            <>
              <span className="text-slate-600">No agent is open. Open one from Agents, or choose a company in Build.</span>
              <button type="button" onClick={() => setTab("agents")} className={btn}>Go to Agents</button>
            </>
          )}
        </div>
      ) : null}

      {tab === "build" ? (
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-950">1. Select company</h2>
          <p className="mt-1 text-sm text-slate-600">
            The agent is wired to the company profile and field data of the company you pick. Any company in your account works, SPVs included. The first time you open one, its agent is created with the Admin default question set.
          </p>
        </div>

        {/* Find a company, from contacts */}
        {viaSearch && picked ? (
          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Find a company</span>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#1A6CE4] bg-[#F4F8FF] px-3 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0A1A40] text-xs font-semibold text-white">
                {(picked.orgName ?? picked.company).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-[160px] flex-1 text-sm">
                <p className="font-semibold text-slate-900">{picked.orgName ?? picked.company}</p>
                <p className="text-xs text-slate-600">{picked.contacts.length} contact{picked.contacts.length === 1 ? "" : "s"}{picked.website ? ` · ${picked.website}` : ""}{picked.country ? ` · ${picked.country}` : ""}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${picked.orgId ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{picked.orgId ? "Selected from contacts" : "Prospect from contacts"}</span>
              <button type="button" onClick={clearSearchPick} className={btn}>
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Find a company</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your contacts by name, company or email" autoComplete="off" className={input} />
            </label>
            {q.trim().length >= 2 ? (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200" role="listbox" aria-label="Contacts">
                <p className="bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">From contacts, grouped by company{searching ? " · searching…" : ""}</p>
                {hits && hits.length === 0 && !searching ? <p className="px-3 py-3 text-sm text-slate-600">No contact matches. Clear the search and choose a company below, or start a new AI Agent.</p> : null}
                {(hits ?? []).map((g) => (
                  <div key={g.key} role="option" aria-selected={false} className="space-y-2 border-t border-slate-100 bg-white px-3 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-[180px] flex-1 text-sm">
                        <span className="block font-semibold text-slate-900">{g.orgName ?? g.company}</span>
                        <span className="block text-xs text-slate-500">
                          {g.contacts.length} contact{g.contacts.length === 1 ? "" : "s"}
                          {!g.orgId && g.website ? ` · ${g.website}` : ""}
                          {!g.orgId && g.country ? ` · ${g.country}` : ""}
                        </span>
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${g.orgId ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{g.orgId ? "In your account" : "Prospect from contacts"}</span>
                      <button type="button" disabled={linking} onClick={() => void pickGroup(g)} className={g.orgId ? "rounded-lg border border-[#1A6CE4] bg-white px-3 py-1.5 text-sm font-semibold text-[#1b3f99] hover:bg-[#F4F8FF] disabled:opacity-50" : btn}>
                        {g.orgId ? "Use this company" : "Start Draft agent"}
                      </button>
                    </div>
                    <ul className="space-y-0.5 pl-1 text-xs text-slate-600">
                      {g.contacts.slice(0, 4).map((c) => (
                        <li key={c.id}>{c.name}{c.email ? ` · ${c.email}` : ""}</li>
                      ))}
                      {g.contacts.length > 4 ? <li>and {g.contacts.length - 4} more</li> : null}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Company list. Blank when the company came from the search. */}
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Company</span>
          <select value={listValue} onChange={(e) => chooseFromList(e.target.value)} className={input}>
            <option value="">{viaSearch ? "Choose a company (left blank: the company comes from your search above)" : "Choose a company"}</option>
            {sorted.map((c) => (
              <option key={c.id} value={`org:${c.id}`}>
                {c.name} · {c.kind} · {c.status ? STATUS_LABEL[c.status] : "No agent yet"}
              </option>
            ))}
            {standalone.length ? (
              <optgroup label="AI Agents without a company">
                {standalone.map((a) => (
                  <option key={a.id} value={`agent:${a.id}`}>
                    {a.name} · No company yet · {STATUS_LABEL[a.status]}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>

        {blank ? (
          <div className="space-y-3 rounded-xl border-2 border-dashed border-[#9db6ee] bg-[#F8FBFF] p-5">
            <div>
              <p className="text-base font-semibold text-slate-900">New AI Agent</p>
              <p className="mt-1 text-sm text-slate-600">No company chosen, so you are starting a new agent. Name it now. You can link a company from your contacts at any time to wire its profile and fields.</p>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Agent name</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="For example, Spring Raise Agent" maxLength={60} className={input} />
            </label>
            <button
              type="button"
              disabled={creating || newName.trim().length < 2}
              onClick={() => void createAgent()}
              className="rounded-lg bg-[#1A6CE4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create new AI Agent"}
            </button>
          </div>
        ) : activeAgent ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            This AI Agent has no company yet, so every field in Selected fields shows Missing. Search your contacts above and choose a company to wire its Company profile.
          </p>
        ) : (
          <p className="rounded-lg bg-[#EEF4FF] px-3 py-2 text-xs text-[#1b3f99]">
            {activeOrg?.kind === "SPV" ? "This is a deal company (SPV). Its Company profile may be thin: add missing fields in Selected fields. " : ""}
            Switching company reloads that company&apos;s agent and selected fields. Save your changes first: unsaved edits are not carried over.
          </p>
        )}
      </section>
      ) : null}

      {tab !== "agents" && choice.kind === "org" ? <IrAgentStudio key={`org:${choice.id}`} orgId={choice.id} tab={tab} /> : null}
      {tab !== "agents" && choice.kind === "agent" ? <IrAgentStudio key={`agent:${choice.id}`} agentId={choice.id} tab={tab} /> : null}
      {tab === "build" && blank ? <p className="py-2 text-sm text-slate-500">Choose a company, find one through your contacts, or create a new AI Agent to start building.</p> : null}
    </div>
  );
}
