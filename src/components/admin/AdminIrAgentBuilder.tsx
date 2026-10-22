"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IrAgentStudio } from "@/components/ir-agent/IrAgentStudio";
import { useToast } from "@/components/ui/ToastProvider";

export type AgentCompany = { id: string; name: string; kind: "Company" | "SPV"; status: "draft" | "live" | "paused" | null };
export type StandaloneAgent = { id: string; name: string; status: "draft" | "live" | "paused" };

type Choice = { kind: "none" } | { kind: "org"; id: string } | { kind: "agent"; id: string };
type ContactHit = { id: string; name: string; email: string | null; company: string; orgId: string | null; orgName: string | null };

const STATUS_LABEL = { draft: "Draft", live: "Live", paused: "Paused" } as const;
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1A6CE4] focus:ring-2 focus:ring-[#1A6CE4]/20";
const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

/**
 * Admin AI Agent. Step 1 picks the company two ways: search your contacts, or
 * choose from the list. Only one of the two shows a company: a company found by
 * search leaves the list blank. Leaving both blank offers a new AI Agent with
 * no company, which a contact search can link to a company later.
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
  // How the company was chosen. "search" leaves the list blank and shows the contact instead.
  const [via, setVia] = useState<"list" | "search">("list");
  const [picked, setPicked] = useState<ContactHit | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ContactHit[] | null>(null);
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
        const j = (await res.json().catch(() => ({}))) as { contacts?: ContactHit[] };
        if (id === reqId.current) setHits(res.ok ? (j.contacts ?? []) : []);
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const activeAgent = choice.kind === "agent" ? standalone.find((a) => a.id === choice.id) ?? null : null;
  const activeOrg = choice.kind === "org" ? companies.find((c) => c.id === choice.id) ?? null : null;

  const pickContact = async (hit: ContactHit) => {
    if (!hit.orgId) return;
    // A company found by search while a company-less agent is open: link it.
    if (activeAgent) {
      setLinking(true);
      try {
        const res = await fetch(`/api/founder/ir-agent/link?agentId=${activeAgent.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: hit.orgId }) });
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Could not link the company.");
        setStandalone((cur) => cur.filter((a) => a.id !== activeAgent.id));
        toast({ title: "Company linked", description: `${hit.orgName ?? hit.company} is now wired to ${activeAgent.name}.`, variant: "success" });
      } catch (e) {
        toast({ title: "Not linked", description: e instanceof Error ? e.message : "Could not link the company.", variant: "error" });
        setLinking(false);
        return;
      }
      setLinking(false);
    }
    setVia("search");
    setPicked(hit);
    setQ("");
    setHits(null);
    choose({ kind: "org", id: hit.orgId });
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
  const viaSearch = via === "search" && picked !== null && choice.kind === "org";
  const sorted = useMemo(() => companies, [companies]);

  return (
    <div className="space-y-5">
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
                {picked.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-[160px] flex-1 text-sm">
                <p className="font-semibold text-slate-900">{picked.name}</p>
                <p className="text-xs text-slate-600">{picked.orgName ?? picked.company}{picked.email ? ` · ${picked.email}` : ""}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Selected from contacts</span>
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
                <p className="bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">From contacts{searching ? " · searching…" : ""}</p>
                {hits && hits.length === 0 && !searching ? <p className="px-3 py-3 text-sm text-slate-600">No contact matches. Clear the search and choose a company below, or start a new AI Agent.</p> : null}
                {(hits ?? []).map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    disabled={!h.orgId || linking}
                    onClick={() => void pickContact(h)}
                    className="flex min-h-[52px] w-full flex-wrap items-center gap-3 border-t border-slate-100 bg-white px-3 py-2 text-left text-sm hover:bg-[#F4F8FF] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="min-w-[160px] flex-1">
                      <span className="block font-medium text-slate-900">{h.name}</span>
                      <span className="block text-xs text-slate-500">{h.company}{h.email ? ` · ${h.email}` : ""}</span>
                    </span>
                    <span className={`text-xs ${h.orgId ? "font-semibold text-[#1b3f99]" : "text-slate-500"}`}>{h.orgId ? `Use ${h.orgName}` : "Not a company in your account"}</span>
                  </button>
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

      {choice.kind === "org" ? <IrAgentStudio key={`org:${choice.id}`} orgId={choice.id} /> : null}
      {choice.kind === "agent" ? <IrAgentStudio key={`agent:${choice.id}`} agentId={choice.id} /> : null}
      {blank ? <p className="py-2 text-sm text-slate-500">Choose a company, find one through your contacts, or create a new AI Agent to start building.</p> : null}
    </div>
  );
}
