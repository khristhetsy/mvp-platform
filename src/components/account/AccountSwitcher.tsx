"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TYPE_LABEL, type Organization } from "@/lib/organizations/organizations";

// Account switcher + "Add a company" (spec §5, §6). `orgs` are the user's
// memberships; `activeOrgId` comes from the validated cookie. `isProfessional`
// gates the Add-a-company card into its locked (Basic) state.
export function AccountSwitcher({
  orgs,
  activeOrgId,
  canAddCompanies,
}: {
  orgs: Organization[];
  activeOrgId: string | null;
  canAddCompanies: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = orgs.find((o) => o.id === activeOrgId) ?? orgs[0] ?? null;

  async function switchOrg(orgId: string) {
    if (orgId === active?.id) { setOpen(false); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/account/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      if (res.ok) { setOpen(false); router.refresh(); }
    } finally {
      setBusy(false);
    }
  }

  async function addCompany() {
    if (!name.trim()) { setError("Company name is required."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/add-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = (await res.json().catch(() => ({}))) as { organization?: Organization; error?: string };
      if (!res.ok || !d.organization) { setError(d.error ?? "Could not add the company."); return; }
      await switchOrg(d.organization.id);
      setShowAdd(false);
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
      >
        <span className="max-w-[160px] truncate font-medium">{active?.name ?? "Select account"}</span>
        {active && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{TYPE_LABEL[active.type]}</span>}
        {active?.purpose && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-violet-700">{active.purpose === "internal" ? "Internal" : "Demo"}</span>}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Your accounts</p>
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => switchOrg(o.id)}
              disabled={busy}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 ${o.id === active?.id ? "bg-slate-50" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate text-slate-800">{o.name}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{TYPE_LABEL[o.type]}</span>
              {o.id === active?.id && <span className="text-emerald-600"><i className="ti ti-check" aria-hidden="true" /></span>}
            </button>
          ))}

          <div className="my-1 border-t border-slate-100" />

          {/* Add-a-company card */}
          {canAddCompanies ? (
            !showAdd ? (
              <button type="button" onClick={() => setShowAdd(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50">
                <span>＋ Add a company</span>
              </button>
            ) : (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5">
                <p className="text-[13px] font-medium text-slate-900">Add a Deal Company</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">A separate account with its own data room, CRM, and audit log — excluded from matching, distribution, and events by design.</p>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" className="mt-2 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
                {error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => { setShowAdd(false); setError(null); }} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600">Cancel</button>
                  <button type="button" onClick={addCompany} disabled={busy} className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">{busy ? "Adding…" : "Add company"}</button>
                </div>
              </div>
            )
          ) : (
            // Locked — the entitlement is super-admin-granted, not self-serve.
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 opacity-90">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-slate-400"><i className="ti ti-lock" aria-hidden="true" /></span>
                <p className="text-[13px] font-medium text-slate-600">Add a company</p>
              </div>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Not enabled for your account. Contact your iCapOS partner to enable adding companies.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
