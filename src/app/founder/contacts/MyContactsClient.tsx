"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FounderToolbar, applySearch, groupRows } from "@/components/founder/FounderToolbar";
import { EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import type { MyContactRow } from "@/lib/founder-crm/my-contacts";
import { contactSourceLabel, contactStatusLabel } from "@/lib/founder-crm/contact-labels";

/**
 * Stage 3 → My contacts. Same list pattern as the admin pages: primary action,
 * search bar with filters / group by / favorites, row checkboxes and a
 * selection bar. Grouped by source by default so imported, introduced and
 * hand-added investors read as three piles.
 */

const SOURCE_ORDER = ["Introduced", "Imported", "Added by you"];
const SOURCE_STYLE: Record<string, string> = {
  Introduced: "bg-emerald-50 text-emerald-700",
  Imported: "bg-indigo-50 text-indigo-700",
  "Added by you": "bg-slate-100 text-slate-600",
};

function csvCell(v: string | null | undefined): string {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function downloadCsv(rows: MyContactRow[]) {
  const header = ["name", "firm", "email", "investor_type", "source", "status", "added"];
  const lines = rows.map((r) =>
    [r.name, r.firm, r.email, r.investorType, r.source, r.status, r.addedAt.slice(0, 10)].map(csvCell).join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my-contacts.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function MyContactsClient({ initialRows }: Readonly<{ initialRows: MyContactRow[] }>) {
  const router = useRouter();
  const [rows, setRows] = useState<MyContactRow[]>(initialRows);
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "source" });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"none" | "add" | "import">("none");
  const [form, setForm] = useState({ name: "", firm: "", email: "", type: "" });
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const filtered = applySearch(rows, search, {
    text: (r) => [r.name, r.firm ?? "", r.email ?? "", r.investorType ?? "", r.sectors ?? ""].join(" "),
    quick: {
      introduced: (r) => r.source === "Introduced",
      imported: (r) => r.source === "Imported",
      added: (r) => r.source === "Added by you",
      has_email: (r) => !!r.email,
    },
    field: {
      source: (r) => r.source,
      status: (r) => r.status,
      type: (r) => r.investorType,
    },
  });

  const groups = useMemo(() => {
    const g = groupRows(filtered, search.groupBy, "none", {
      source: (r) => r.source,
      status: (r) => r.status,
      type: (r) => r.investorType ?? "",
    });
    if (search.groupBy === "source") {
      g.sort((a, b) => SOURCE_ORDER.indexOf(a.label) - SOURCE_ORDER.indexOf(b.label));
    }
    return g;
  }, [filtered, search.groupBy]);

  const pickedRows = rows.filter((r) => picked.has(r.id));
  const allFilteredPicked = filtered.length > 0 && filtered.every((r) => picked.has(r.id));

  function togglePick(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function reload() {
    router.refresh();
    try {
      const res = await fetch("/api/founder/investor-contacts");
      if (!res.ok) return;
      const data = (await res.json()) as {
        contacts?: Array<{ id: string; investor_name: string; firm_name: string | null; email: string | null; investor_type: string | null; source: string; status: string; preferred_sectors: string | null; created_at: string }>;
      };
      if (!Array.isArray(data.contacts)) return;
      const own: MyContactRow[] = data.contacts.map((c) => ({
        id: c.id,
        kind: "contact",
        name: c.investor_name,
        firm: c.firm_name,
        email: c.email,
        investorType: c.investor_type,
        source: contactSourceLabel(c.source),
        status: contactStatusLabel(c.status),
        sectors: c.preferred_sectors,
        addedAt: c.created_at,
      }));
      setRows((prev) => [...prev.filter((r) => r.kind === "intro"), ...own]);
    } catch {
      /* the router refresh above still brings the page up to date */
    }
  }

  async function addContact() {
    if (!form.name.trim()) {
      setMessage({ tone: "error", text: "Enter the investor's name." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/investor-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investor_name: form.name.trim(),
          firm_name: form.firm.trim() || undefined,
          email: form.email.trim(),
          investor_type: form.type.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessage({ tone: "error", text: data?.error ?? "Couldn't add that contact." });
        return;
      }
      setForm({ name: "", firm: "", email: "", type: "" });
      setPanel("none");
      setMessage({ tone: "ok", text: "Contact added." });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function importCsv() {
    if (!csvText.trim()) {
      setMessage({ tone: "error", text: "Paste at least one CSV row first." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/investor-contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvText, confirm: true }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessage({ tone: "error", text: data?.error ?? "Import failed. Check the CSV columns and try again." });
        return;
      }
      setCsvText("");
      setPanel("none");
      setMessage({ tone: "ok", text: "Import complete." });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function archivePicked() {
    const ids = pickedRows.filter((r) => r.kind === "contact").map((r) => r.id);
    if (ids.length === 0) {
      setMessage({ tone: "error", text: "Introduced investors can't be removed here. Pick contacts you imported or added." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/founder/investor-contacts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archive: true }),
          }),
        ),
      );
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      setPicked(new Set());
      setMessage({ tone: "ok", text: `${ids.length} contact${ids.length === 1 ? "" : "s"} archived.` });
    } finally {
      setBusy(false);
    }
  }

  const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white" style={{ borderColor: "var(--border-subtle)" }}>
        <FounderToolbar
          scope="my-contacts"
          state={search}
          onChange={setSearch}
          count={filtered.length}
          countLabel="contacts"
          placeholder="Search name, firm, email, sector…"
          primary={
            <button type="button" onClick={() => setPanel(panel === "add" ? "none" : "add")} className="cap-btn-primary rounded-lg px-3 py-1.5 text-[12.5px] font-semibold">
              + New
            </button>
          }
          quick={[
            { key: "introduced", label: "Introduced by iCapOS" },
            { key: "imported", label: "Imported" },
            { key: "added", label: "Added by you" },
            { key: "has_email", label: "Has an email", sep: true },
          ]}
          fields={[
            { key: "source", label: "Source", options: SOURCE_ORDER },
            { key: "status", label: "Status", options: [...new Set(rows.map((r) => r.status))] },
            { key: "type", label: "Investor type", options: [...new Set(rows.map((r) => r.investorType).filter((x): x is string => !!x))] },
          ]}
          groups={[
            { id: "none", label: "None" },
            { id: "source", label: "Source" },
            { id: "status", label: "Status" },
            { id: "type", label: "Investor type" },
          ]}
          right={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPanel(panel === "import" ? "none" : "import")} className={btn}>
                <i className="ti ti-upload" aria-hidden="true" /> Import CSV
              </button>
              <button type="button" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0} className={`${btn} disabled:opacity-50`}>
                <i className="ti ti-download" aria-hidden="true" /> Export
              </button>
            </div>
          }
        />

        {panel === "add" ? (
          <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
            {([
              ["name", "Name", "Ada Lovelace"],
              ["firm", "Firm", "Analytical Ventures"],
              ["email", "Email", "ada@av.com"],
              ["type", "Investor type", "Angel"],
            ] as const).map(([k, label, ph]) => (
              <label key={k} className="min-w-[150px] flex-1 text-[11px] font-medium text-slate-500">
                {label}
                <input
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  placeholder={ph}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800"
                />
              </label>
            ))}
            <button type="button" onClick={() => void addContact()} disabled={busy} className="cap-btn-primary rounded-lg px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50">
              {busy ? "Saving…" : "Add contact"}
            </button>
          </div>
        ) : null}

        {panel === "import" ? (
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[12px] text-slate-600">
              Paste rows with the columns <span className="font-mono">investor_name, firm_name, email</span>. Duplicates by email are skipped.
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={4}
              placeholder="investor_name,firm_name,email&#10;Ada Lovelace,Analytical Ventures,ada@av.com"
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
            />
            <button type="button" onClick={() => void importCsv()} disabled={busy} className="mt-2 cap-btn-primary rounded-lg px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50">
              {busy ? "Importing…" : "Import"}
            </button>
          </div>
        ) : null}

        {picked.size > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-indigo-50/60 px-4 py-2 text-[12.5px]">
            <span className="font-semibold text-slate-800">{picked.size} selected</span>
            {!allFilteredPicked ? (
              <button type="button" onClick={() => setPicked(new Set(filtered.map((r) => r.id)))} className="font-medium text-indigo-600 hover:underline">
                Select all {filtered.length}
              </button>
            ) : null}
            <button type="button" onClick={() => setPicked(new Set())} className="text-slate-500 hover:text-slate-700" aria-label="Clear selection">
              ×
            </button>
            <span className="flex-1" />
            <Link href="/founder/deploy" className={btn}>Add to outreach</Link>
            <button type="button" onClick={() => downloadCsv(pickedRows)} className={btn}>Export selected</button>
            <button type="button" onClick={() => void archivePicked()} disabled={busy} className={`${btn} disabled:opacity-50`}>Archive</button>
          </div>
        ) : null}

        {message ? (
          <p className={`border-b border-slate-100 px-4 py-2 text-[12px] ${message.tone === "ok" ? "text-emerald-700" : "text-red-600"}`} role="status">
            {message.text}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-800">
              {rows.length === 0 ? "Start your contact book" : "No contacts match your search"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] text-slate-500">
              {rows.length === 0
                ? "Import a CSV or add investors you already know. Investors iCapOS introduces you to appear here on their own."
                : "Clear a filter or try another name."}
            </p>
          </div>
        ) : (
          <table className="w-full table-fixed text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allFilteredPicked}
                    onChange={() => setPicked(allFilteredPicked ? new Set() : new Set(filtered.map((r) => r.id)))}
                  />
                </th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="hidden px-2 py-2 font-medium md:table-cell">Email</th>
                <th className="hidden w-36 px-2 py-2 font-medium sm:table-cell">Type</th>
                <th className="w-32 px-2 py-2 font-medium">Source</th>
                <th className="hidden w-36 px-2 py-2 font-medium sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isCollapsed = collapsed.has(g.label);
                return (
                  <Fragment key={g.label || "all"}>
                    {g.label ? (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsed((prev) => {
                                const n = new Set(prev);
                                if (n.has(g.label)) n.delete(g.label);
                                else n.add(g.label);
                                return n;
                              })
                            }
                            className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700"
                            aria-expanded={!isCollapsed}
                          >
                            <i className={`ti ${isCollapsed ? "ti-chevron-right" : "ti-chevron-down"}`} aria-hidden="true" />
                            {g.label === "Introduced" ? "Introduced by iCapOS" : g.label} · {g.rows.length}
                          </button>
                        </td>
                      </tr>
                    ) : null}
                    {isCollapsed
                      ? null
                      : g.rows.map((r) => (
                          <tr key={r.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                            <td className="px-4 py-2.5">
                              <input type="checkbox" aria-label={`Select ${r.name}`} checked={picked.has(r.id)} onChange={() => togglePick(r.id)} />
                            </td>
                            <td className="px-2 py-2.5">
                              <p className="truncate font-medium text-slate-900">{r.name}</p>
                              {r.firm ? <p className="truncate text-[11.5px] text-slate-400">{r.firm}</p> : null}
                            </td>
                            <td className="hidden truncate px-2 py-2.5 text-slate-600 md:table-cell">
                              {r.email ?? <span className="text-slate-300">{r.kind === "intro" ? "Shared in the intro" : "—"}</span>}
                            </td>
                            <td className="hidden truncate px-2 py-2.5 text-slate-600 sm:table-cell">{r.investorType ?? "—"}</td>
                            <td className="px-2 py-2.5">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SOURCE_STYLE[r.source] ?? SOURCE_STYLE["Added by you"]}`}>
                                {r.source}
                              </span>
                            </td>
                            <td className="hidden truncate px-2 py-2.5 text-slate-600 sm:table-cell">{r.status}</td>
                          </tr>
                        ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11.5px] leading-relaxed text-slate-400">
        Only your own investors appear here. Investors in the iCapOS network stay private until iCFO introduces you. Contacts
        here are the same list your manual outreach draws from.
      </p>
    </div>
  );
}
