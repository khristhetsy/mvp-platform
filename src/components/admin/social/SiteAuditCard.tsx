"use client";

import { useEffect, useState } from "react";
import type { AuditFinding, AuditStatus } from "@/lib/social/site-audit";

const card = "rounded-xl border border-slate-200 bg-white";
type Audit = { id: string; url: string; run_at: string; findings: AuditFinding[]; approved_at: string | null };
const STATUS_CLS: Record<AuditStatus, string> = { found: "bg-emerald-50 text-emerald-700", check: "bg-amber-50 text-amber-700", review: "bg-amber-50 text-amber-700" };
const STATUS_LABEL: Record<AuditStatus, string> = { found: "Found", check: "Check", review: "Review" };

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Site audit. Reads the public company pages and proposes what replies should say and avoid.
 * Findings stay proposed until staff approve them. It never edits the site.
 */
export function SiteAuditCard() {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/social/site-audit").then((r) => r.json()).then((d: { audit?: Audit | null }) => {
      if (live) { setAudit(d.audit ?? null); setLoaded(true); }
    }).catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);

  async function run() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/social/site-audit", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "Couldn't run the audit. Try again.");
      setAudit((j as { audit: Audit }).audit);
    } catch (e) { setMsg({ tone: "warn", text: (e as Error).message }); }
    finally { setBusy(false); }
  }

  async function approve() {
    if (!audit) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/social/site-audit", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: audit.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "Couldn't approve the findings.");
      setAudit({ ...audit, approved_at: new Date().toISOString() });
      setMsg({ tone: "ok", text: "Findings approved." });
    } catch (e) { setMsg({ tone: "warn", text: (e as Error).message }); }
    finally { setBusy(false); }
  }

  return (
    <div className={`${card} p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <i className="ti ti-search text-[18px] text-slate-700" aria-hidden="true" />
        <h2 className="text-[15px] font-semibold text-slate-900">Site audit</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${audit?.approved_at ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {!loaded ? "Loading" : !audit ? "Not run yet" : audit.approved_at ? "Approved" : "Proposed"}
        </span>
        <div className="ml-auto flex gap-2">
          {audit && !audit.approved_at ? (
            <button type="button" onClick={() => void approve()} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Approve findings</button>
          ) : null}
          <button type="button" onClick={() => void run()} disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Working…" : audit ? "Run audit again" : "Run audit now"}</button>
        </div>
      </div>
      <p className="mt-1 text-[12px] text-slate-500">Reads the public pages of the company site and proposes what replies should say and avoid. It never edits the site.</p>

      {audit ? (
        <div className="mt-3">
          <ul className="divide-y divide-slate-100">
            {audit.findings.map((f) => (
              <li key={f.key} className="flex items-start gap-3 py-2 text-[12.5px]">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{f.label}</p>
                  <p className="text-slate-500">{f.detail}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${STATUS_CLS[f.status]}`}>{STATUS_LABEL[f.status]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">Read from {audit.url} on {when(audit.run_at)}.</p>
        </div>
      ) : null}
      {msg ? <p className={`mt-3 text-[12.5px] ${msg.tone === "ok" ? "text-emerald-700" : "text-amber-700"}`}>{msg.text}</p> : null}
    </div>
  );
}
