"use client";

/**
 * Odoo-style "Open: Contact" popup for an investor: the contact fields (membership, address,
 * job position, phone, email, website, created on, assigned staff), then tabs for the
 * investor questionnaire and the IR projects they are on. Read-only here; the contact is
 * edited in the Sales Hub, which the footer links to.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { IR_STAGE_LABEL, type IrStage } from "@/lib/ir/types";

type Detail = {
  contact: {
    email: string | null; phone: string | null; mobile: string | null; jobPosition: string | null; website: string | null;
    address: { street: string | null; city: string | null; state: string | null; zip: string | null; country: string | null };
    createdOn: string | null; membership: string | null; assignees: string[];
    profile: { investorTypes: string[]; industries: string[]; operatingStages: string[]; fundingStages: string[]; capital: string[]; businessEntity: string[]; investmentSize: string[]; revenueRange: string[] };
  };
  investor: { id: string; name: string | null; firm: string | null; dataSource: string | null; verifiedAt: string | null };
  matches: Array<{ matchId: string; projectTitle: string; founderName: string | null; stage: IrStage; stageChangedAt: string }>;
};
type Tab = "address" | "profile" | "ir";

const fmtDay = (iso: string) => new Date(iso.replace(" ", "T")).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

function Tags({ v }: { v: string[] }) {
  return v.length ? <span className="flex flex-wrap gap-1">{v.map((x) => <span key={x} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11.5px] text-indigo-700">{x}</span>)}</span> : <span className="text-slate-400">—</span>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5"><span className="font-medium text-slate-600">{label}</span><span className="min-w-0 break-words text-slate-800">{children}</span></div>;
}
const dash = (v: string | null | undefined) => (v ? v : <span className="text-slate-400">—</span>);

export function InvestorContactDialog({ contactId, onClose, matchId }: { contactId: string; onClose: () => void; matchId?: string | null }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("address");
  useEffect(() => {
    let live = true;
    void fetch(`/api/admin/ir/investors/${contactId}?detail=1`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) setErr(j.error ?? "Couldn't load the contact."); else setD(j);
    });
    return () => { live = false; };
  }, [contactId]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const c = d?.contact;
  const name = d?.investor.name ?? d?.investor.firm ?? "Investor";
  const addr = c ? [c.address.street, [c.address.city, c.address.state, c.address.zip].filter(Boolean).join(" "), c.address.country].filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={`Contact: ${name}`} className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white text-[13px] shadow-2xl">
        <div className="flex items-center border-b border-slate-100 px-5 py-3">
          <p className="text-[15px] font-semibold text-slate-900">Open: Contact</p>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-lg bg-slate-100 px-2 py-1 text-slate-600 hover:bg-slate-200"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {err ? <p className="text-rose-600">{err}</p> : !d || !c ? <p className="text-slate-400">Loading…</p> : (
            <>
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-slate-500">{d.investor.firm && d.investor.firm !== d.investor.name ? "Individual · " + d.investor.firm : "Individual"}</p>
                  <h3 className="mt-1 truncate text-[26px] font-semibold text-slate-900">{name}</h3>
                </div>
                <span className="inline-flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-indigo-50 text-[22px] font-semibold text-indigo-700">{name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
              </div>
              <div className="mt-3 grid gap-x-8 sm:grid-cols-2">
                <div>
                  <F label="Membership type">{dash(c.membership)}</F>
                  <F label="Contact">{addr.length ? addr.map((l, i) => <span key={i} className="block">{l}</span>) : dash(null)}</F>
                  <F label="Data source">{d.investor.dataSource === "verified" ? `Verified${d.investor.verifiedAt ? ` ${fmtDay(d.investor.verifiedAt)}` : ""}` : d.investor.dataSource === "self_reported" ? "Self-reported" : "Unverified"}</F>
                </div>
                <div>
                  <F label="Job position">{dash(c.jobPosition)}</F>
                  <F label="Phone">{c.phone ? <a href={`tel:${c.phone}`} className="text-slate-800 hover:text-indigo-700">{c.phone}</a> : dash(null)}</F>
                  {c.mobile && c.mobile !== c.phone ? <F label="Mobile">{c.mobile}</F> : null}
                  <F label="Email">{c.email ? <span className="select-all">{c.email}</span> : dash(null)}</F>
                  <F label="Website">{c.website ? <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">{c.website.replace(/^https?:\/\//, "")}</a> : dash(null)}</F>
                  <F label="Created on">{c.createdOn ? fmtDay(c.createdOn) : dash(null)}</F>
                  <F label="Assigned to"><Tags v={c.assignees} /></F>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap border-b border-slate-200" role="tablist">
                {([["address", "Contact & address"], ["profile", "Investor profile"], ["ir", `IR projects · ${d.matches.length}`]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px rounded-t-lg border px-3 py-2 ${tab === k ? "border-slate-200 border-b-white bg-white font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{l}</button>
                ))}
              </div>
              <div className="py-3">
                {tab === "address" ? (
                  <div className="grid gap-x-8 sm:grid-cols-2">
                    <div><F label="Street">{dash(c.address.street)}</F><F label="City">{dash(c.address.city)}</F><F label="State">{dash(c.address.state)}</F></div>
                    <div><F label="ZIP">{dash(c.address.zip)}</F><F label="Country">{dash(c.address.country)}</F></div>
                  </div>
                ) : tab === "profile" ? (
                  <div className="grid gap-x-8 sm:grid-cols-2">
                    <div><F label="Investor type"><Tags v={c.profile.investorTypes} /></F><F label="Industries"><Tags v={c.profile.industries} /></F><F label="Investment size"><Tags v={c.profile.investmentSize} /></F><F label="Revenue range"><Tags v={c.profile.revenueRange} /></F></div>
                    <div><F label="Operating stage"><Tags v={c.profile.operatingStages} /></F><F label="Funding stage"><Tags v={c.profile.fundingStages} /></F><F label="Type of capital"><Tags v={c.profile.capital} /></F><F label="Business entity"><Tags v={c.profile.businessEntity} /></F></div>
                  </div>
                ) : d.matches.length === 0 ? <p className="text-slate-500">Not on any IR project yet.</p> : (
                  <ul className="divide-y divide-slate-100">
                    {d.matches.map((m) => (
                      <li key={m.matchId} className="flex items-center gap-2 py-1.5">
                        <Link href={`/admin/ir/matches/${m.matchId}`} className={`min-w-0 flex-1 truncate hover:text-indigo-700 ${m.matchId === matchId ? "font-semibold text-indigo-800" : "text-slate-800"}`}>{m.projectTitle}{m.founderName ? <span className="text-slate-400"> · {m.founderName}</span> : null}</Link>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{IR_STAGE_LABEL[m.stage]}</span>
                        <span className="w-24 text-right text-[11.5px] text-slate-400">{fmtDay(m.stageChangedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          {matchId ? <Link href={`/admin/ir/matches/${matchId}`} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">Open IR record</Link> : null}
          <Link href={`/admin/sales/contacts/${contactId}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">Edit in Sales Hub</Link>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50">Close</button>
        </div>
      </div>
    </div>
  );
}
