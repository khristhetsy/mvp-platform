"use client";

/**
 * Founder › Investor directory tab shell. One connector per tab, like Admin's
 * Contact connectors: Directory (public investor records), LinkedIn, CSV or Excel,
 * and Form D (SEC EDGAR firms). Only the open tab is mounted, so each loads on
 * demand. LinkedIn and CSV or Excel reuse the existing import dialog, which maps
 * columns, previews and saves into My contacts (shown in Manual outreach as Imported).
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { InvestorDirectoryClient } from "@/components/founder/investor-directory/InvestorDirectoryClient";
import { ContactImportDialog } from "@/components/founder/outreach/ContactImportDialog";

type Tab = "directory" | "linkedin" | "csv" | "formd";

const FORM_D_SOURCE = "SEC Form D";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "directory", label: "Directory", icon: "ti-address-book" },
  { id: "linkedin", label: "LinkedIn", icon: "ti-brand-linkedin" },
  { id: "csv", label: "CSV or Excel", icon: "ti-file-spreadsheet" },
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

type ContactLite = { email: string | null; source: string };

const CSV_SOURCES = new Set(["csv_import", "import", "csv"]);

const COPY = {
  linkedin: {
    icon: "ti-brand-linkedin",
    title: "LinkedIn connections",
    description: "Upload the Connections.csv from your LinkedIn data export. Columns are matched for you and you preview before anything is saved.",
    note: "LinkedIn withholds most email addresses, so many connections import as names only and can't be emailed until you add one.",
    button: "Import Connections.csv",
    mode: "linkedin" as const,
  },
  csv: {
    icon: "ti-file-spreadsheet",
    title: "CSV or Excel file",
    description: "Drop a .csv or .xlsx, or paste rows from a spreadsheet. Map the columns, preview, then import.",
    note: "Up to 5,000 rows per import. Duplicates of contacts you already hold are skipped.",
    button: "Import a file",
    mode: "file" as const,
  },
};

function ImportConnectorTab({ kind }: Readonly<{ kind: "linkedin" | "csv" }>) {
  const copy = COPY[kind];
  const [contacts, setContacts] = useState<ContactLite[] | null>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/founder/investor-contacts");
      if (!res.ok) return;
      const body = (await res.json()) as { contacts?: ContactLite[] };
      if (Array.isArray(body.contacts)) setContacts(body.contacts);
    } catch {
      /* counts stay blank */
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const mine = (contacts ?? []).filter((c) => (kind === "linkedin" ? c.source === "linkedin" : CSV_SOURCES.has(c.source)));
  const stat = (n: number | null) => (n === null ? "…" : n.toLocaleString());

  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-wrap items-center gap-2">
        <i className={`ti ${copy.icon} text-xl text-slate-700`} aria-hidden />
        <h2 className="text-base font-semibold text-slate-950">{copy.title}</h2>
        <span className="flex-1" />
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#1558BE]">
          {copy.button}
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-600">{copy.description}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <span className="block text-xs text-slate-500">Imported from here</span>
          <b className="text-lg font-semibold text-slate-900">{stat(contacts ? mine.length : null)}</b>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <span className="block text-xs text-slate-500">With an email</span>
          <b className="text-lg font-semibold text-slate-900">{stat(contacts ? mine.filter((c) => c.email).length : null)}</b>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{copy.note}</p>
      {notice ? (
        <p className="mt-3 text-sm font-medium text-emerald-700">
          {notice}{" "}
          <Link href="/founder/contacts" className="underline">View My contacts</Link>
          {" · "}
          <Link href="/founder/deploy?step=outreach&mode=manual" className="underline">Manual outreach</Link>
        </p>
      ) : null}
      {open ? (
        <ContactImportDialog
          mode={copy.mode}
          existingEmails={(contacts ?? []).map((c) => c.email ?? "").filter(Boolean)}
          onClose={() => setOpen(false)}
          onImported={async (count) => {
            setOpen(false);
            setNotice(`${count.toLocaleString()} contact${count === 1 ? "" : "s"} imported.`);
            await load();
          }}
        />
      ) : null}
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
      ) : tab === "linkedin" || tab === "csv" ? (
        <ImportConnectorTab kind={tab} />
      ) : (
        <>
          <FormDCard total={formdTotal} />
          <InvestorDirectoryClient pinnedSource={FORM_D_SOURCE} onTotal={setFormdTotal} />
        </>
      )}
    </div>
  );
}
