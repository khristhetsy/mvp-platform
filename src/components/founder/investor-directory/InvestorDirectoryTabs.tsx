"use client";

/**
 * Founder › Investor directory tab shell. One connector per tab, like Admin's
 * Contact connectors: Directory (public investor records) and Form D (SEC EDGAR
 * firms). Only the open tab is mounted, so each loads its own list on demand.
 */
import { useState } from "react";
import { InvestorDirectoryClient } from "@/components/founder/investor-directory/InvestorDirectoryClient";

type Tab = "directory" | "formd";

const FORM_D_SOURCE = "SEC Form D";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "directory", label: "Directory", icon: "ti-address-book" },
  { id: "formd", label: "Form D", icon: "ti-file-certificate" },
];

function FormDCard({ total }: Readonly<{ total: number | null }>) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-wrap items-center gap-2">
        <i className="ti ti-building-bank text-xl text-slate-700" aria-hidden />
        <h2 className="text-base font-semibold text-slate-950">SEC EDGAR, Form D</h2>
        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Verified registry</span>
        <span className="flex-1" />
        <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
          <span className="text-slate-500">Firms in registry </span>
          <b className="text-sm font-semibold text-slate-900">{total === null ? "…" : total.toLocaleString()}</b>
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Investment firms from SEC Form D filings, screened against OFAC and SEC. Refreshed by iCFO Capital. Select firms and
        add them to your Manual outreach.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Form D lists firms, not people. These records have a firm name, location, phone and website, but no contact name or
        email, so they can&apos;t be emailed from Manual outreach until you add one. Not the iCFO Capital investor network.
      </p>
    </div>
  );
}

export function InvestorDirectoryTabs() {
  const [tab, setTab] = useState<Tab>("directory");
  const [formdTotal, setFormdTotal] = useState<number | null>(null);

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Investor directory">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === id ? "border-[#1A6CE4] text-slate-950" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className={`ti ${icon}`} style={{ fontSize: 16 }} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "directory" ? (
        <InvestorDirectoryClient />
      ) : (
        <>
          <FormDCard total={formdTotal} />
          <InvestorDirectoryClient pinnedSource={FORM_D_SOURCE} onTotal={setFormdTotal} />
        </>
      )}
    </div>
  );
}
