"use client";

import { useMemo, useState } from "react";
import { IrAgentStudio } from "@/components/ir-agent/IrAgentStudio";

export type AgentCompany = { id: string; name: string; kind: "Company" | "SPV"; status: "draft" | "live" | "paused" | null };

const STATUS_LABEL = { draft: "Draft", live: "Live", paused: "Paused" } as const;

/**
 * Admin AI Agent: pick a company, then build its investor relations agent with
 * the same studio founders use. The studio is keyed by company, so switching
 * company reloads the agent with that company's profile data.
 */
export function AdminIrAgentBuilder({ companies, initialOrgId }: { companies: AgentCompany[]; initialOrgId: string | null }) {
  const [orgId, setOrgId] = useState(initialOrgId && companies.some((c) => c.id === initialOrgId) ? initialOrgId : "");
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return companies.filter((c) => !q || c.name.toLowerCase().includes(q) || c.id === orgId);
  }, [companies, filter, orgId]);

  const choose = (id: string) => {
    setOrgId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("org", id);
    else url.searchParams.delete("org");
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">1. Select company</h2>
        <p className="mt-1 text-sm text-slate-600">The agent is wired to the company profile and field data of the company you pick. Any company in your account works, SPVs included. The first time you open one, its agent is created with the question set that matches its owner's membership.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="block min-w-[200px] flex-1 text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Find a company</span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Type to filter"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1A6CE4] focus:ring-2 focus:ring-[#1A6CE4]/20"
            />
          </label>
          <label className="block min-w-[260px] flex-[2] text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Company</span>
            <select
              value={orgId}
              onChange={(e) => choose(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1A6CE4] focus:ring-2 focus:ring-[#1A6CE4]/20"
            >
              <option value="">Choose a company</option>
              {visible.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.kind} · {c.status ? STATUS_LABEL[c.status] : "No agent yet"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 rounded-lg bg-[#EEF4FF] px-3 py-2 text-xs text-[#1b3f99]">
          Switching company reloads that company&apos;s agent and selected fields. Save your changes first: unsaved edits are not carried over.
        </p>
      </section>

      {orgId ? <IrAgentStudio key={orgId} orgId={orgId} /> : <p className="py-6 text-sm text-slate-500">Choose a company to build its agent.</p>}
    </div>
  );
}
