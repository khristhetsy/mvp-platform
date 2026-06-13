"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MarketingContact, MarketingList } from "@/lib/marketing/types";

interface Props {
  contacts: MarketingContact[];
  lists: MarketingList[];
  total: number;
  page: number;
  limit: number;
  currentSearch: string;
  currentListId: string;
}

export function ContactsTable({ contacts, lists, total, page, limit, currentSearch, currentListId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);
  const [listId, setListId] = useState(currentListId);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const totalPages = Math.ceil(total / limit);

  function applyFilters(newSearch: string, newListId: string) {
    const params = new URLSearchParams();
    if (newSearch) params.set("search", newSearch);
    if (newListId) params.set("list_id", newListId);
    startTransition(() => router.push(`/admin/marketing/contacts?${params.toString()}`));
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));

    const rows = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });

    const res = await fetch("/api/marketing/import-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, list_id: listId || null }),
    });
    const data = await res.json();
    setImportResult(`Imported ${data.imported} contacts. Skipped ${data.skipped} invalid rows.`);
    setImporting(false);
    router.refresh();
  }

  const initials = (c: MarketingContact) => {
    const fn = (c.first_name?.[0] ?? "").toUpperCase();
    const ln = (c.last_name?.[0] ?? "").toUpperCase();
    return fn + ln || c.email[0].toUpperCase();
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by name, email, company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters(search, listId)}
          style={{ flex: 1, minWidth: 200, fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
        />
        <select
          value={listId}
          onChange={(e) => { setListId(e.target.value); applyFilters(search, e.target.value); }}
          style={{ fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
        >
          <option value="">All lists</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button
          onClick={() => applyFilters(search, listId)}
          style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
        >
          Search
        </button>
        <button
          onClick={() => setShowImport(!showImport)}
          style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
        >
          ↑ Import CSV
        </button>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
        >
          + Add contact
        </button>
      </div>

      {/* CSV import */}
      {showImport && (
        <div style={{ background: "var(--muted)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Import contacts from CSV</div>
          <div style={{ color: "var(--muted-foreground)", marginBottom: 10 }}>
            Expected columns: <code>email, first_name, last_name, company, title, source</code>
          </div>
          <input type="file" accept=".csv" onChange={handleCsvImport} disabled={importing} />
          {importing && <span style={{ marginLeft: 12, color: "var(--muted-foreground)" }}>Importing…</span>}
          {importResult && <div style={{ marginTop: 8, color: "#3B6D11" }}>{importResult}</div>}
        </div>
      )}

      {/* Add contact form */}
      {showAdd && <AddContactForm lists={lists} onDone={() => { setShowAdd(false); router.refresh(); }} />}

      {/* Table */}
      <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              {["", "Name / email", "Company", "Source", "Added"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)" }}>
                  No contacts yet. Import a CSV or add one manually.
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                <td style={{ padding: "8px 14px", width: 36 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", background: "#EEEDFE", color: "#3C3489",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500,
                  }}>
                    {initials(c)}
                  </div>
                </td>
                <td style={{ padding: "8px 14px" }}>
                  <div style={{ fontWeight: 500 }}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                  </div>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{c.email}</div>
                </td>
                <td style={{ padding: "8px 14px", color: "var(--muted-foreground)" }}>{c.company ?? "—"}</td>
                <td style={{ padding: "8px 14px" }}>
                  {c.source ? (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#E6F1FB", color: "#185FA5", fontWeight: 500 }}>
                      {c.source}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ padding: "8px 14px", color: "var(--muted-foreground)" }}>
                  {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
          {page > 1 && (
            <a href={`/admin/marketing/contacts?page=${page - 1}&search=${search}&list_id=${listId}`}
               style={{ padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--border)", textDecoration: "none", color: "var(--foreground)" }}>
              ← Previous
            </a>
          )}
          <span style={{ padding: "6px 12px", color: "var(--muted-foreground)" }}>
            Page {page} of {totalPages} · {total.toLocaleString()} contacts
          </span>
          {page < totalPages && (
            <a href={`/admin/marketing/contacts?page=${page + 1}&search=${search}&list_id=${listId}`}
               style={{ padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--border)", textDecoration: "none", color: "var(--foreground)" }}>
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function AddContactForm({ lists, onDone }: { lists: MarketingList[]; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch("/api/marketing/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to save");
    } else {
      onDone();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: "var(--muted)", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 12 }}>Add contact</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { name: "email", label: "Email *", type: "email", required: true },
          { name: "first_name", label: "First name", type: "text" },
          { name: "last_name", label: "Last name", type: "text" },
          { name: "company", label: "Company", type: "text" },
          { name: "title", label: "Title", type: "text" },
          { name: "source", label: "Source", type: "text" },
        ].map((f) => (
          <div key={f.name}>
            <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>{f.label}</label>
            <input
              name={f.name}
              type={f.type}
              required={f.required}
              style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
            />
          </div>
        ))}
      </div>
      {error && <div style={{ color: "#A32D2D", fontSize: 13, marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={saving}
          style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
        >
          {saving ? "Saving…" : "Save contact"}
        </button>
        <button
          type="button"
          onClick={onDone}
          style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
