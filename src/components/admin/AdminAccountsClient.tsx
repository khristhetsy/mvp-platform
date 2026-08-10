"use client";

import { useMemo, useState } from "react";
import {
  TYPE_LABEL,
  BILLING_LABEL,
  type Organization,
  type OrgType,
} from "@/lib/organizations/organizations";

const BILLING_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  comped: "bg-indigo-50 text-indigo-700 border-indigo-200",
  past_due: "bg-amber-50 text-amber-800 border-amber-200",
  canceled: "bg-slate-100 text-slate-500 border-slate-200",
  incomplete: "bg-slate-100 text-slate-500 border-slate-200",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AdminAccountsClient({ initialOrgs, canManage }: { initialOrgs: Organization[]; canManage: boolean }) {
  const [orgs, setOrgs] = useState<Organization[]>(initialOrgs);
  const [typeFilter, setTypeFilter] = useState<"all" | OrgType>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [cType, setCType] = useState<OrgType>("founder");
  const [cName, setCName] = useState("");
  const [cPurpose, setCPurpose] = useState<"demo" | "internal">("demo");
  const [cTier, setCTier] = useState<"basic" | "professional">("professional");
  const [creating, setCreating] = useState(false);

  const visible = useMemo(
    () => (typeFilter === "all" ? orgs : orgs.filter((o) => o.type === typeFilter)),
    [orgs, typeFilter],
  );

  async function createAccount() {
    if (!cName.trim()) { setError("Name is required."); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: cType, name: cName.trim(), purpose: cPurpose, tier: cType === "founder" ? cTier : undefined }),
      });
      const d = (await res.json().catch(() => ({}))) as { organization?: Organization; error?: string };
      if (!res.ok || !d.organization) { setError(d.error ?? "Could not create account."); return; }
      setOrgs((prev) => [d.organization!, ...prev]);
      setShowCreate(false);
      setCName("");
    } finally {
      setCreating(false);
    }
  }

  async function toggleComped(org: Organization) {
    const next = org.billing_status === "comped" ? "active" : "comped";
    setBusyId(org.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing_status: next }),
      });
      const d = (await res.json().catch(() => ({}))) as { organization?: Organization; error?: string };
      if (res.ok && d.organization) {
        setOrgs((prev) => prev.map((o) => (o.id === org.id ? d.organization! : o)));
      } else {
        setError(d.error ?? "Update failed.");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "founder", "spv"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setTypeFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${typeFilter === f ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {f === "all" ? "All" : TYPE_LABEL[f]}
          </button>
        ))}
        <div className="flex-1" />
        {canManage ? (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {showCreate ? "Close" : "+ Create account"}
          </button>
        ) : (
          <span className="text-xs text-slate-400">View only — ask a super admin for the “Manage Accounts” permission to create accounts.</span>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {/* Create panel */}
      {showCreate && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Create account</p>
          <p className="mt-0.5 text-xs text-slate-500">Provisions immediately — comped, email dispatch off. Demo / internal use only.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Type</label>
              <select value={cType} onChange={(e) => setCType(e.target.value as OrgType)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="founder">{TYPE_LABEL.founder}</option>
                <option value="spv">{TYPE_LABEL.spv}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Name</label>
              <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. Doyle Organics" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Purpose</label>
              <select value={cPurpose} onChange={(e) => setCPurpose(e.target.value as "demo" | "internal")} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="demo">Demo</option>
                <option value="internal">Internal use</option>
              </select>
            </div>
            {cType === "founder" && (
              <div>
                <label className="text-xs font-medium text-slate-500">Tier (CRR weighting)</label>
                <select value={cTier} onChange={(e) => setCTier(e.target.value as "basic" | "professional")} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="professional">Professional</option>
                  <option value="basic">Basic</option>
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={createAccount} disabled={creating} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {creating ? "Creating…" : "Create account"}
            </button>
          </div>
        </div>
      )}

      {/* Registry */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[1.7fr_1fr_1fr_1fr_120px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-400 sm:grid">
          <span>Account</span><span>Type</span><span>Billing</span><span>Created</span><span className="text-right">Entitlement</span>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">No accounts yet.</p>
        ) : visible.map((o) => (
          <div key={o.id} className="grid grid-cols-1 gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[1.7fr_1fr_1fr_1fr_120px] sm:items-center sm:gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900">
                {o.name}
                {o.purpose && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium capitalize text-violet-700">{o.purpose === "internal" ? "Internal" : "Demo"}</span>
                )}
              </p>
              {o.created_via === "admin_direct" && (
                <p className="text-[11px] text-slate-400">Admin-created{o.email_dispatch_enabled ? "" : " · email off"}</p>
              )}
            </div>
            <span className="text-[13px] text-slate-700">{TYPE_LABEL[o.type]}</span>
            <span>
              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${BILLING_STYLE[o.billing_status] ?? BILLING_STYLE.incomplete}`}>
                {BILLING_LABEL[o.billing_status] ?? o.billing_status}
              </span>
            </span>
            <span className="text-[12px] text-slate-500">{fmtDate(o.created_at)}</span>
            <div className="sm:text-right">
              {canManage ? (
                <button
                  type="button"
                  onClick={() => toggleComped(o)}
                  disabled={busyId === o.id}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busyId === o.id ? "…" : o.billing_status === "comped" ? "Un-comp" : "Comp"}
                </button>
              ) : (
                <span className="text-[11px] text-slate-300">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
