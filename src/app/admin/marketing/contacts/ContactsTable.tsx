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

const AVATAR_COLORS = [
  { bg: "#EEEDFE", color: "#3C3489" },
  { bg: "#E1F5EE", color: "#085041" },
  { bg: "#E6F1FB", color: "#0C447C" },
  { bg: "#FAEEDA", color: "#633806" },
  { bg: "#FBEAF0", color: "#72243E" },
];

const SOURCE_BADGE: Record<string, { bg: string; color: string }> = {
  icfo:       { bg: "#EEEDFE", color: "#3C3489" },
  cold:       { bg: "#F1EFE8", color: "#444441" },
  csv_import: { bg: "#E6F1FB", color: "#185FA5" },
  csv:        { bg: "#E6F1FB", color: "#185FA5" },
  manual:     { bg: "#E1F5EE", color: "#0F6E56" },
};

function avatarColor(email: string) {
  const idx = email.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function sourceBadge(source: string | null | undefined) {
  if (!source) return null;
  const key = source.toLowerCase().replace(/\s+/g, "_");
  return SOURCE_BADGE[key] ?? { bg: "#F1EFE8", color: "#5F5E5A" };
}

export function ContactsTable({ contacts, lists, total, page, limit, currentSearch, currentListId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);
  const [listId, setListId] = useState(currentListId);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const totalPages = Math.ceil(total / limit);

  function applyFilters(s: string, l: string) {
    const params = new URLSearchParams();
    if (s) params.set("search", s);
    if (l) params.set("list_id", l);
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
    setImportResult({ ok: true, msg: `Imported ${data.imported} contacts. Skipped ${data.skipped} invalid rows.` });
    setImporting(false);
    router.refresh();
  }

  function initials(c: MarketingContact) {
    const fn = (c.first_name?.[0] ?? "").toUpperCase();
    const ln = (c.last_name?.[0] ?? "").toUpperCase();
    return fn + ln || c.email[0].toUpperCase();
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>Contacts</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{total.toLocaleString()} total</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setShowImport(!showImport); setShowAdd(false); }}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)", cursor: "pointer" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import CSV
          </button>
          <button
            onClick={() => { setShowAdd(!showAdd); setShowImport(false); }}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add contact
          </button>
        </div>
      </div>

      {/* CSV import panel */}
      {showImport && (
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Import contacts from CSV</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
            Expected columns: <code style={{ fontSize: 11, background: "var(--muted)", padding: "1px 5px", borderRadius: 4 }}>email, first_name, last_name, company, title, source</code>
          </div>
          <input type="file" accept=".csv" onChange={handleCsvImport} disabled={importing} style={{ fontSize: 12 }} />
          {importing && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--muted-foreground)" }}>Importing…</span>}
          {importResult && (
            <div style={{ marginTop: 8, fontSize: 12, color: importResult.ok ? "#0F6E56" : "#A32D2D" }}>{importResult.msg}</div>
          )}
        </div>
      )}

      {/* Add contact form */}
      {showAdd && <AddContactForm lists={lists} onDone={() => { setShowAdd(false); router.refresh(); }} />}

      {/* Search + filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters(search, listId)}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--foreground)" }}
          />
        </div>
        <select
          value={listId}
          onChange={(e) => { setListId(e.target.value); applyFilters(search, e.target.value); }}
          style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}
        >
          <option value="">All lists</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button
          onClick={() => applyFilters(search, listId)}
          style={{ fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)", cursor: "pointer" }}
        >
          Search
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "36px 2fr 1.5fr 100px 80px 70px", padding: "8px 16px", background: "var(--muted)", borderBottom: "0.5px solid var(--border)" }}>
          {["", "Contact", "Company", "Source", "Added", ""].map((h, i) => (
            <div key={i} style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>{h}</div>
          ))}
        </div>

        {contacts.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
            No contacts yet. Import a CSV or add one manually.
          </div>
        ) : (
          contacts.map((c) => {
            const av = avatarColor(c.email);
            const sb = sourceBadge(c.source);
            return (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "36px 2fr 1.5fr 100px 80px 70px", padding: "10px 16px", borderBottom: "0.5px solid var(--border)", alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: av.bg, color: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500 }}>
                  {initials(c)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{c.email}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.company ?? "—"}</div>
                <div>
                  {sb && c.source ? (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sb.bg, color: sb.color, fontWeight: 500 }}>
                      {c.source}
                    </span>
                  ) : <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <DeleteContactButton contactId={c.id} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {total.toLocaleString()} contacts · page {page} of {Math.max(totalPages, 1)}
        </span>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 4 }}>
            {page > 1 && (
              <a
                href={`/admin/marketing/contacts?page=${page - 1}&search=${search}&list_id=${listId}`}
                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", textDecoration: "none" }}
              >
                ← Prev
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/admin/marketing/contacts?page=${page + 1}&search=${search}&list_id=${listId}`}
                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", textDecoration: "none" }}
              >
                Next →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteContactButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    await fetch(`/api/marketing/contacts?id=${contactId}`, { method: "DELETE" });
    router.refresh();
  }

  if (confirming) {
    return (
      <button
        onClick={handleDelete}
        style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }}
      >
        Confirm
      </button>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "0.5px solid var(--border)", color: "var(--muted-foreground)", background: "transparent", cursor: "pointer" }}
      title="Delete contact"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
    </button>
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
    <form onSubmit={handleSubmit} style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Add contact</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { name: "email",      label: "Email *",  type: "email", required: true },
          { name: "first_name", label: "First name", type: "text" },
          { name: "last_name",  label: "Last name",  type: "text" },
          { name: "company",    label: "Company",    type: "text" },
          { name: "title",      label: "Title",      type: "text" },
          { name: "source",     label: "Source",     type: "text" },
        ].map((f) => (
          <div key={f.name}>
            <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>{f.label}</label>
            <input
              name={f.name} type={f.type} required={f.required}
              style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
            />
          </div>
        ))}
      </div>
      {lists.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Add to list (optional)</label>
          <select name="list_id" style={{ fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}>
            <option value="">— none —</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}
      {error && <div style={{ color: "#A32D2D", fontSize: 12, marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}>
          {saving ? "Saving…" : "Save contact"}
        </button>
        <button type="button" onClick={onDone} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
