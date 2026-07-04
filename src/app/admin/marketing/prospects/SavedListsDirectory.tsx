"use client";

// Step 4 · Contact Lists — directory of saved lists (left), click one to see its
// details (right): stats, contact preview, and actions (Campaigns, Export, Rename, Archive).

import { useCallback, useEffect, useState } from "react";
import type { SavedList, ListDetail } from "@/lib/prospects/saved-lists";

export function SavedListsDirectory() {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ListDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const loadLists = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/prospects/lists");
      const data = res.ok ? await res.json() : [];
      const arr = Array.isArray(data) ? data : [];
      setLists(arr);
      setSelId((cur) => cur ?? (arr[0]?.id ?? null));
    } catch { setLists([]); }
    setLoadingList(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch saved lists on mount
  useEffect(() => { void loadLists(); }, [loadLists]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true); setRenaming(false);
    try {
      const res = await fetch(`/api/prospects/lists/${id}`);
      setDetail(res.ok ? await res.json() : null);
    } catch { setDetail(null); }
    setLoadingDetail(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load detail when selection changes
  useEffect(() => { if (selId) void loadDetail(selId); }, [selId, loadDetail]);

  async function saveName() {
    if (!selId || !nameDraft.trim()) return;
    setBusy(true);
    await fetch(`/api/prospects/lists/${selId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nameDraft.trim() }) });
    setRenaming(false); setBusy(false);
    await loadLists(); await loadDetail(selId);
  }

  async function archive() {
    if (!selId) return;
    if (!confirm("Archive this list? It will be hidden from the directory (contacts are kept).")) return;
    setBusy(true);
    await fetch(`/api/prospects/lists/${selId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: true }) });
    setBusy(false); setSelId(null); setDetail(null);
    await loadLists();
  }

  const when = (s: string) => new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800 }}>Saved contact lists</h3>
        <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>· click a list to see details</span>
      </div>

      {loadingList ? (
        <p style={{ ...card, padding: 28, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</p>
      ) : lists.length === 0 ? (
        <div style={{ ...card, padding: 28, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No saved lists yet. Build one on <b>Import</b> (filter &amp; save) or <b>AI Approach</b> (save a scored slice).</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, alignItems: "start" }}>
          {/* directory */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lists.map((l) => {
              const active = l.id === selId;
              return (
                <button key={l.id} onClick={() => setSelId(l.id)} style={{ textAlign: "left", cursor: "pointer", border: active ? "1px solid #2E78F5" : "0.5px solid #e2e6ed", background: active ? "#EFF6FF" : "#fff", borderRadius: 9, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12.5, fontWeight: active ? 700 : 600, color: active ? "#1A4E9E" : "var(--foreground)" }}>{l.name}</div>
                  <div style={{ fontSize: 10.5, color: active ? "#1A6CE4" : "var(--muted-foreground)" }}>{l.contact_count.toLocaleString()} contacts · {when(l.created_at)}</div>
                </button>
              );
            })}
          </div>

          {/* detail */}
          <div style={card}>
            {loadingDetail || !detail ? (
              <p style={{ padding: 28, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>{loadingDetail ? "Loading…" : "Select a list."}</p>
            ) : (
              <>
                <div style={{ padding: "13px 15px", borderBottom: "0.5px solid var(--border)" }}>
                  {renaming ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus style={{ flex: 1, fontSize: 14, fontWeight: 600, border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "6px 9px" }} />
                      <button onClick={saveName} disabled={busy} style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>Save</button>
                      <button onClick={() => setRenaming(false)} style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{detail.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{detail.description ? `${detail.description} · ` : ""}saved {when(detail.created_at)}</div>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: "13px 15px", borderBottom: "0.5px solid var(--border)" }}>
                  <div><div style={{ fontSize: 18, fontWeight: 800 }}>{detail.contact_count.toLocaleString()}</div><div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>contacts</div></div>
                </div>

                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", padding: "12px 15px", borderBottom: "0.5px solid var(--border)" }}>
                  <a href={`/admin/marketing/lists?list=${detail.id}`} style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#2E78F5", borderRadius: 6, padding: "7px 12px", textDecoration: "none" }}>→ Send to Contact Lists</a>
                  <a href={`/api/prospects/lists/${detail.id}/export?format=csv&cols=name,email,company,lead_status`} style={{ fontSize: 11, fontWeight: 700, color: "#1A6CE4", background: "#fff", border: "0.5px solid #93C5FD", borderRadius: 6, padding: "7px 12px", textDecoration: "none" }}>Export CSV ↓</a>
                  <button onClick={() => { setNameDraft(detail.name); setRenaming(true); }} style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 6, padding: "7px 12px", cursor: "pointer" }}>Rename</button>
                  <button onClick={archive} disabled={busy} style={{ fontSize: 11, fontWeight: 600, color: "#B91C1C", background: "#fff", border: "0.5px solid #FECACA", borderRadius: 6, padding: "7px 12px", cursor: "pointer" }}>Archive</button>
                </div>

                <div style={{ padding: "12px 15px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)", marginBottom: 6 }}>Preview</div>
                  {detail.preview.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No contacts in this list.</p>
                  ) : detail.preview.map((c, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.7fr 1fr", gap: 8, padding: "6px 0", borderBottom: "0.5px solid var(--border)", fontSize: 11.5, alignItems: "center" }}>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name || c.email}</span>
                      <span style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.email}</span>
                      <span style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.company ?? "—"}</span>
                    </div>
                  ))}
                  {detail.contact_count > detail.preview.length ? (
                    <p style={{ fontSize: 11, color: "var(--muted-foreground)", paddingTop: 8 }}>Showing first {detail.preview.length} of {detail.contact_count.toLocaleString()}. Export from Step 5 for the full list with all columns.</p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
