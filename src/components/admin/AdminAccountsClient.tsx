"use client";

import { useMemo, useState } from "react";
import {
  TYPE_LABEL,
  BILLING_LABEL,
  type Organization,
  type OrgType,
} from "@/lib/organizations/organizations";
import { OpenAsFounderButton } from "@/components/admin/OpenAsFounderButton";
import type { Conversion, ConvertPlan } from "@/lib/organizations/convert-to-paid";
import { PLAN_LABELS, PLAN_PRICES } from "@/lib/subscriptions/plans";

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

type FounderLink = { id: string; name: string };

export function AdminAccountsClient({
  initialOrgs,
  canManage,
  founders: initialFounders,
  canOpenAs,
  conversions: initialConversions,
  canConvert,
}: {
  initialOrgs: Organization[];
  canManage: boolean;
  founders: Record<string, FounderLink>;
  canOpenAs: boolean;
  conversions: Record<string, Conversion>;
  canConvert: boolean;
}) {
  const [orgs, setOrgs] = useState<Organization[]>(initialOrgs);
  const [founders, setFounders] = useState<Record<string, FounderLink>>(initialFounders);
  const [conversions, setConversions] = useState<Record<string, Conversion>>(initialConversions);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [vPlan, setVPlan] = useState<ConvertPlan>("founder_professional");
  const [vName, setVName] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vCompany, setVCompany] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
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
      const d = (await res.json().catch(() => ({}))) as {
        organization?: Organization;
        error?: string;
        founderId?: string | null;
        founderName?: string | null;
        provisionError?: string | null;
      };
      if (!res.ok || !d.organization) { setError(d.error ?? "Could not create account."); return; }
      setOrgs((prev) => [d.organization!, ...prev]);
      if (d.founderId) {
        setFounders((prev) => ({ ...prev, [d.organization!.id]: { id: d.founderId!, name: d.founderName ?? d.organization!.name } }));
      }
      if (d.provisionError) setError(`Account created, but the founder was not set up: ${d.provisionError}`);
      setShowCreate(false);
      setCName("");
    } finally {
      setCreating(false);
    }
  }

  function openConvert(org: Organization) {
    setConvertId(org.id);
    setVPlan(org.tier === "basic" ? "founder_basic" : "founder_professional");
    setVName(org.name);
    setVEmail("");
    setVCompany("");
    setError(null);
    setNotice(null);
  }

  // send: true emails the checkout link to the client. send: false only returns it (Copy link).
  async function convert(org: Organization, opts: { send: boolean; fresh: boolean }) {
    if (opts.fresh && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vEmail.trim())) { setError("Enter the client's email address."); return; }
    setBusyId(org.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/accounts/${org.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          opts.fresh
            ? { plan: vPlan, billToName: vName, billToEmail: vEmail.trim(), company: vCompany || undefined, send: opts.send }
            : { send: opts.send },
        ),
      });
      const d = (await res.json().catch(() => ({}))) as { url?: string; emailed?: boolean; conversion?: Conversion; error?: string };
      if (!res.ok || !d.conversion) { setError(d.error ?? "Could not create the checkout link."); return; }
      setConversions((prev) => ({ ...prev, [org.id]: d.conversion! }));
      setConvertId(null);
      if (opts.send) {
        setNotice(d.emailed ? `Checkout link sent to ${d.conversion.email}.` : "The checkout link was made but the email did not send. Use Copy link.");
      } else if (d.url) {
        try {
          await navigator.clipboard.writeText(d.url);
          setNotice("Checkout link copied.");
        } catch {
          setNotice(`Checkout link: ${d.url}`);
        }
      }
    } finally {
      setBusyId(null);
    }
  }

  async function setUpFounder(org: Organization) {
    setBusyId(org.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${org.id}/provision`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { founderId?: string; founderName?: string; error?: string };
      if (res.ok && d.founderId) {
        setFounders((prev) => ({ ...prev, [org.id]: { id: d.founderId!, name: d.founderName ?? org.name } }));
      } else {
        setError(d.error ?? "Could not set up the founder.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCanAdd(org: Organization) {
    setBusyId(org.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ can_add_companies: !org.can_add_companies }),
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
      {notice && <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

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
        <div className="hidden grid-cols-[1.7fr_1fr_1fr_1fr_220px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-400 sm:grid">
          <span>Account</span><span>Type</span><span>Billing</span><span>Created</span><span className="text-right">Entitlement</span>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">No accounts yet.</p>
        ) : visible.map((o) => (
          <div key={o.id} className="border-b border-slate-100 last:border-b-0">
          <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1.7fr_1fr_1fr_1fr_220px] sm:items-center sm:gap-3">
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
              {conversions[o.id] && o.purpose === "demo" && (
                <p className="text-[11px] text-slate-400">Checkout link sent to {conversions[o.id].email}</p>
              )}
            </div>
            <span className="text-[13px] text-slate-700">{TYPE_LABEL[o.type]}</span>
            <span>
              {conversions[o.id] && o.purpose === "demo" ? (
                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">Pending payment</span>
              ) : (
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${BILLING_STYLE[o.billing_status] ?? BILLING_STYLE.incomplete}`}>
                  {BILLING_LABEL[o.billing_status] ?? o.billing_status}
                </span>
              )}
            </span>
            <span className="text-[12px] text-slate-500">{fmtDate(o.created_at)}</span>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {canManage ? (
                <>
                  {canConvert && o.type === "founder" && o.created_via === "admin_direct" && o.purpose === "demo" && founders[o.id] && !conversions[o.id] && (
                    <button
                      type="button"
                      onClick={() => (convertId === o.id ? setConvertId(null) : openConvert(o))}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      Convert to paid
                    </button>
                  )}
                  {canConvert && o.purpose === "demo" && conversions[o.id] && (
                    <>
                      <button type="button" onClick={() => convert(o, { send: false, fresh: false })} disabled={busyId === o.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        {busyId === o.id ? "…" : "Copy link"}
                      </button>
                      <button type="button" onClick={() => convert(o, { send: true, fresh: false })} disabled={busyId === o.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        Resend
                      </button>
                    </>
                  )}
                  {o.type === "founder" && o.created_via === "admin_direct" && founders[o.id] && canOpenAs && (
                    <OpenAsFounderButton founderId={founders[o.id].id} founderName={founders[o.id].name} />
                  )}
                  {o.type === "founder" && o.created_via === "admin_direct" && !founders[o.id] && (
                    <button
                      type="button"
                      onClick={() => setUpFounder(o)}
                      disabled={busyId === o.id}
                      title="This account has no founder or company yet"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {busyId === o.id ? "…" : "Set up founder"}
                    </button>
                  )}
                  {o.type === "founder" && (
                    <button
                      type="button"
                      onClick={() => toggleCanAdd(o)}
                      disabled={busyId === o.id}
                      title="Allow this founder to add additional companies"
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${o.can_add_companies ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {busyId === o.id ? "…" : o.can_add_companies ? "Add: on" : "Allow add"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleComped(o)}
                    disabled={busyId === o.id}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {busyId === o.id ? "…" : o.billing_status === "comped" ? "Un-comp" : "Comp"}
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-slate-300">—</span>
              )}
            </div>
          </div>
          {convertId === o.id && (
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Convert {o.name} to paid</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">Plan</label>
                  <select value={vPlan} onChange={(e) => setVPlan(e.target.value as ConvertPlan)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <option value="founder_professional">{PLAN_LABELS.founder_professional} · ${Math.round(PLAN_PRICES.founder_professional / 100)} per month</option>
                    <option value="founder_basic">{PLAN_LABELS.founder_basic} · ${Math.round(PLAN_PRICES.founder_basic / 100)} per month</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Bill to name</label>
                  <input value={vName} onChange={(e) => setVName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Bill to email</label>
                  <input value={vEmail} onChange={(e) => setVEmail(e.target.value)} placeholder="name@company.com" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Company</label>
                  <input value={vCompany} onChange={(e) => setVCompany(e.target.value)} placeholder="Legal company name" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                <li>The client enters their own card at Lemon Squeezy and is billed every month.</li>
                <li>Receipts and failed payment notices go to the bill to email.</li>
                <li>The account stays comped and a demo until the first payment arrives.</li>
              </ul>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setConvertId(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={() => convert(o, { send: true, fresh: true })} disabled={busyId === o.id} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                  {busyId === o.id ? "Sending…" : "Send checkout link"}
                </button>
              </div>
            </div>
          )}
          </div>
        ))}
      </div>
    </div>
  );
}
