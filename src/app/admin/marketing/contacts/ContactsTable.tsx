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
  currentTag: string;
}

const AVATAR_COLORS = [
  { bg: "#EEEDFE", color: "#3C3489" },
  { bg: "#E1F5EE", color: "#085041" },
  { bg: "#E6F1FB", color: "#0C447C" },
  { bg: "#FAEEDA", color: "#633806" },
  { bg: "#FBEAF0", color: "#72243E" },
];
const EVENT_COLOR: Record<string, { bg: string; color: string }> = {
  sent:       { bg: "#F1EFE8", color: "#5F5E5A" },
  delivered:  { bg: "#E1F5EE", color: "#0F6E56" },
  opened:     { bg: "#E6F1FB", color: "#185FA5" },
  clicked:    { bg: "#EEEDFE", color: "#3C3489" },
  bounced:    { bg: "#FAEEDA", color: "#854F0B" },
  unsubscribed: { bg: "#FCEBEB", color: "#A32D2D" },
  spam_complaint: { bg: "#FCEBEB", color: "#A32D2D" },
};
const SOURCE_BADGE: Record<string, { bg: string; color: string }> = {
  icfo:       { bg: "#EEEDFE", color: "#3C3489" },
  cold:       { bg: "#F1EFE8", color: "#444441" },
  csv_import: { bg: "#E6F1FB", color: "#185FA5" },
  csv:        { bg: "#E6F1FB", color: "#185FA5" },
  manual:     { bg: "#E1F5EE", color: "#0F6E56" },
};
function avatarColor(email: string) { return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length]; }
function sourceBadge(s?: string | null) {
  if (!s) return null;
  return SOURCE_BADGE[s.toLowerCase().replace(/\s+/g, "_")] ?? { bg: "#F1EFE8", color: "#5F5E5A" };
}
function initials(c: MarketingContact) {
  const fn = (c.first_name?.[0] ?? "").toUpperCase();
  const ln = (c.last_name?.[0] ?? "").toUpperCase();
  return fn + ln || c.email[0].toUpperCase();
}

type ActivityEvent = {
  id: string; event_type: string; occurred_at: string;
  campaign_name: string | null; sequence_name: string | null; metadata: Record<string, unknown>;
};
type ActivityData = {
  contact: MarketingContact & { created_at: string };
  events: ActivityEvent[];
  unsubscribed: { email: string; reason: string | null; unsubscribed_at: string } | null;
};

export function ContactsTable({ contacts, lists, total, page, limit, currentSearch, currentListId, currentTag }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);
  const [listId, setListId] = useState(currentListId);
  const [tagFilter, setTagFilter] = useState(currentTag);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [editTagsId, setEditTagsId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [localTags, setLocalTags] = useState<Record<string, string[]>>({});
  const [activityId, setActivityId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const totalPages = Math.ceil(total / limit);

  // Collect all unique tags across contacts for filter suggestions
  const allTags = [...new Set(contacts.flatMap((c) => c.tags ?? []))].sort();

  function applyFilters(s: string, l: string, t: string) {
    const params = new URLSearchParams();
    if (s) params.set("search", s);
    if (l) params.set("list_id", l);
    if (t) params.set("tag", t);
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

  function getContactTags(c: MarketingContact): string[] {
    return localTags[c.id] !== undefined ? localTags[c.id] : (c.tags ?? []);
  }

  async function saveTag(contactId: string, tags: string[]) {
    setLocalTags((prev) => ({ ...prev, [contactId]: tags }));
    await fetch(`/api/marketing/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
  }

  function addTag(contactId: string, tag: string) {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) return;
    const current = getContactTags(contacts.find((c) => c.id === contactId)!);
    if (current.includes(clean)) return;
    void saveTag(contactId, [...current, clean]);
    setTagInput("");
  }

  function removeTag(contact: MarketingContact, tag: string) {
    const current = getContactTags(contact);
    void saveTag(contact.id, current.filter((t) => t !== tag));
  }

  async function openActivity(contact: MarketingContact) {
    setActivityId(contact.id);
    setLoadingActivity(true);
    setActivity(null);
    const res = await fetch(`/api/marketing/contacts/${contact.id}/activity`);
    if (res.ok) setActivity(await res.json());
    setLoadingActivity(false);
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
          <button onClick={() => { setShowImport(!showImport); setShowAdd(false); }}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)", cursor: "pointer" }}>
            ↑ Import CSV
          </button>
          <button onClick={() => { setShowAdd(!showAdd); setShowImport(false); }}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}>
            + Add contact
          </button>
        </div>
      </div>

      {showImport && (
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Import contacts from CSV</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
            Columns: <code style={{ fontSize: 11, background: "var(--muted)", padding: "1px 5px", borderRadius: 4 }}>email, first_name, last_name, company, title, source</code>
          </div>
          <input type="file" accept=".csv" onChange={handleCsvImport} disabled={importing} style={{ fontSize: 12 }} />
          {importing && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--muted-foreground)" }}>Importing…</span>}
          {importResult && <div style={{ marginTop: 8, fontSize: 12, color: "#0F6E56" }}>{importResult.msg}</div>}
        </div>
      )}
      {showAdd && <AddContactForm lists={lists} onDone={() => { setShowAdd(false); router.refresh(); }} />}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8, background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
          <input
            type="text" placeholder="Search name, email, company…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters(search, listId, tagFilter)}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--foreground)" }}
          />
        </div>
        <select value={listId} onChange={(e) => { setListId(e.target.value); applyFilters(search, e.target.value, tagFilter); }}
          style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>
          <option value="">All lists</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={tagFilter} onChange={(e) => { setTagFilter(e.target.value); applyFilters(search, listId, e.target.value); }}
          style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>
          <option value="">All tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => applyFilters(search, listId, tagFilter)}
          style={{ fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)", cursor: "pointer" }}>
          Filter
        </button>
        {(search || listId || tagFilter) && (
          <button onClick={() => { setSearch(""); setListId(""); setTagFilter(""); applyFilters("", "", ""); }}
            style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "none", background: "var(--muted)", color: "var(--muted-foreground)", cursor: "pointer" }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "36px 2fr 1.3fr 1.2fr 90px 80px", padding: "8px 16px", background: "var(--muted)", borderBottom: "0.5px solid var(--border)" }}>
          {["", "Contact", "Company", "Tags", "Source", ""].map((h, i) => (
            <div key={i} style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>{h}</div>
          ))}
        </div>

        {contacts.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
            No contacts match your filters.
          </div>
        ) : (
          contacts.map((c) => {
            const av = avatarColor(c.email);
            const sb = sourceBadge(c.source);
            const tags = getContactTags(c);
            const isEditingTags = editTagsId === c.id;
            return (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "36px 2fr 1.3fr 1.2fr 90px 80px", padding: "10px 16px", borderBottom: "0.5px solid var(--border)", alignItems: "center" }}>
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
                {/* Tags cell */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                  {tags.map((tag) => (
                    <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 6px", borderRadius: 12, background: "#EEEDFE", color: "#3C3489", fontWeight: 500 }}>
                      {tag}
                      {isEditingTags && (
                        <button onClick={() => removeTag(c, tag)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3C3489", padding: 0, lineHeight: 1, fontSize: 11 }}>×</button>
                      )}
                    </span>
                  ))}
                  {isEditingTags ? (
                    <input
                      autoFocus value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(c.id, tagInput); }
                        if (e.key === "Escape") setEditTagsId(null);
                      }}
                      placeholder="add tag…"
                      style={{ fontSize: 10, width: 70, border: "1px solid #534AB7", borderRadius: 8, padding: "2px 5px", outline: "none", background: "var(--input)" }}
                    />
                  ) : (
                    <button onClick={() => { setEditTagsId(c.id); setTagInput(""); }}
                      style={{ fontSize: 10, padding: "2px 6px", borderRadius: 12, border: "1px dashed var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>
                      + tag
                    </button>
                  )}
                </div>
                {/* Source */}
                <div>
                  {sb && c.source ? (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sb.bg, color: sb.color, fontWeight: 500 }}>{c.source}</span>
                  ) : <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => openActivity(c)}
                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "0.5px solid var(--border)", color: "var(--muted-foreground)", background: "transparent", cursor: "pointer" }}
                    title="View activity">
                    ↗
                  </button>
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
              <a href={`/admin/marketing/contacts?page=${page - 1}&search=${search}&list_id=${listId}&tag=${tagFilter}`}
                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", textDecoration: "none" }}>
                ← Prev
              </a>
            )}
            {page < totalPages && (
              <a href={`/admin/marketing/contacts?page=${page + 1}&search=${search}&list_id=${listId}&tag=${tagFilter}`}
                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", textDecoration: "none" }}>
                Next →
              </a>
            )}
          </div>
        )}
      </div>

      {/* Activity drawer */}
      {activityId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setActivityId(null)}>
          <div style={{ width: 480, height: "100%", background: "var(--card)", borderLeft: "1px solid var(--border)", overflowY: "auto", padding: 24 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Contact activity</h3>
              <button onClick={() => setActivityId(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted-foreground)" }}>×</button>
            </div>

            {loadingActivity && <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</div>}
            {activity && (
              <>
                <div style={{ marginBottom: 20, padding: "12px 14px", background: "var(--muted)", borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{[activity.contact.first_name, activity.contact.last_name].filter(Boolean).join(" ") || activity.contact.email}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{activity.contact.email}</div>
                  {activity.contact.company && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{activity.contact.company}</div>}
                  <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(activity.contact.tags ?? []).map((t) => (
                      <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 12, background: "#EEEDFE", color: "#3C3489" }}>{t}</span>
                    ))}
                  </div>
                  {activity.unsubscribed && (
                    <div style={{ marginTop: 8, fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "#FCEBEB", color: "#A32D2D" }}>
                      Unsubscribed · {new Date(activity.unsubscribed.unsubscribed_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 10 }}>
                  {activity.events.length} events
                </div>

                {activity.events.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No email events yet.</div>
                ) : (
                  activity.events.map((ev) => {
                    const ec = EVENT_COLOR[ev.event_type] ?? { bg: "#F1EFE8", color: "#5F5E5A" };
                    return (
                      <div key={ev.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10, paddingBottom: 10, borderBottom: "0.5px solid var(--border)" }}>
                        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 12, background: ec.bg, color: ec.color, fontWeight: 500, whiteSpace: "nowrap", marginTop: 1 }}>
                          {ev.event_type}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "var(--foreground)" }}>
                            {ev.campaign_name ?? ev.sequence_name ?? "—"}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                            {new Date(ev.occurred_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>
      )}
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
    return <button onClick={handleDelete} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }}>Confirm</button>;
  }
  return (
    <button onClick={() => setConfirming(true)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "0.5px solid var(--border)", color: "var(--muted-foreground)", background: "transparent", cursor: "pointer" }} title="Delete">
      🗑
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
    const res = await fetch("/api/marketing/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); }
    else onDone();
    setSaving(false);
  }
  return (
    <form onSubmit={handleSubmit} style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Add contact</div>
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
            <input name={f.name} type={f.type} required={f.required} style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
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
        <button type="submit" disabled={saving} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}>{saving ? "Saving…" : "Save contact"}</button>
        <button type="button" onClick={onDone} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>Cancel</button>
      </div>
    </form>
  );
}
