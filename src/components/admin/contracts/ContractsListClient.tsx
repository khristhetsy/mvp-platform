"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { ToolbarGear, NewButton, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { CONTRACT_TYPES, CONTRACT_TYPE_LABEL, STATUS_LABEL, type ContractStatus, type ContractType } from "@/lib/contracts/types";
import { ContactPicker } from "./ContactPicker";
import { UploadContractModal } from "./UploadContractModal";
import { api, fmtDate, fmtDateTime, MUTED, NAVY, Notice, StatusPill } from "./ui";

type Row = {
  id: string;
  version: number;
  status: ContractStatus;
  sent_at: string | null;
  updated_at: string;
  archived_at: string | null;
  contact_id: string | null;
  template_id?: string | null;
  created_at: string;
  source?: "template" | "upload";
  contract_type?: ContractType | null;
  page_count?: number | null;
  mine: boolean;
  template: { name: string; kind: string } | null;
  entity: { short_name: string; legal_name: string } | null;
  contact: { name: string | null; company: string | null; email: string | null } | null;
  request: { open_count: number; last_opened_at: string | null } | null;
};

/** A saved, resumable send (Send Contracts › Save draft). */
type SavedSend = { contact_id: string; step: number; term_sheet_id: string | null; extra_ids: string[]; upload_ids: string[]; updated_at: string; contact: { name: string | null; company: string | null } | null };
const STEP_LABEL: Record<number, string> = { 1: "choosing documents", 2: "editing documents", 3: "cover email" };
function fmtPt(iso: string): string {
  return `${new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} PT`;
}

const QUICK = [
  { key: "awaiting", label: "Awaiting signature" },
  { key: "countersign", label: "Awaiting countersign" },
  { key: "attention", label: "Needs attention" },
  { key: "signed", label: "Signed" },
  { key: "drafts", label: "Drafts" },
  { key: "mine", label: "Sent by me", sep: true },
  { key: "archived", label: "Include archived", sep: true },
];
const GROUPS = [
  { id: "none", label: "None" },
  { id: "status", label: "Status" },
  { id: "contact", label: "Contact" },
  { id: "document", label: "Document" },
];

const SEARCH_FIELDS: SearchField<Row>[] = [
  { label: "document", get: (r) => r.template?.name },
  { label: "contact", get: (r) => r.contact?.name },
  { label: "company", get: (r) => r.contact?.company },
  { label: "email", get: (r) => r.contact?.email },
  { label: "entity", get: (r) => r.entity?.legal_name },
  { label: "status", get: (r) => STATUS_LABEL[r.status] },
  { label: "type", get: (r) => (r.contract_type ? CONTRACT_TYPE_LABEL[r.contract_type] : null) },
];

export function ContractsListClient() {
  const [rows, setRows] = useState<Row[]>([]);
  // A second copy of the same document for the same contact (Create new contract) shows as "#2".
  const copyNo = useMemo(() => {
    const seen: Record<string, number> = {};
    const out: Record<string, number> = {};
    for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      if (!r.contact_id || !r.template_id) continue;
      const k = `${r.contact_id}:${r.template_id}`;
      out[r.id] = seen[k] = (seen[k] ?? 0) + 1;
    }
    return out;
  }, [rows]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "none" });
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<"all" | "uploaded">("all");
  const [type, setType] = useState<ContractType | "">("");
  const withArchived = search.quick.includes("archived");
  const showDrafts = search.quick.includes("drafts") && view === "all";
  const [sends, setSends] = useState<SavedSend[]>([]);

  // Drafts also lists saved sends, each resumable where it was left.
  useEffect(() => {
    if (!showDrafts) return;
    let alive = true;
    void api<{ drafts: SavedSend[] }>("/api/admin/sales/contracts/send-drafts").then((r) => {
      if (alive && r.ok) setSends(r.data.drafts ?? []);
    });
    return () => {
      alive = false;
    };
  }, [showDrafts]);

  useEffect(() => {
    let alive = true;
    void api<{ documents: Row[] }>(`/api/admin/sales/contracts${withArchived ? "?archived=1" : ""}`).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (!r.ok) setError(r.data.error ?? "Could not load contracts.");
      else setRows(r.data.documents ?? []);
    });
    return () => {
      alive = false;
    };
  }, [withArchived]);

  const uploads = useMemo(() => rows.filter((r) => r.source === "upload"), [rows]);
  const filtered = useMemo(() => {
    let list = view === "uploaded" ? uploads.filter((r) => !type || r.contract_type === type) : rows;
    const q = new Set(search.quick);
    if (q.has("awaiting")) list = list.filter((r) => r.status === "sent" || r.status === "viewed");
    if (q.has("countersign")) list = list.filter((r) => r.status === "awaiting_countersign");
    if (q.has("attention")) list = list.filter((r) => ["changes_requested", "declined", "expired"].includes(r.status));
    if (q.has("signed")) list = list.filter((r) => r.status === "signed");
    if (q.has("drafts")) list = list.filter((r) => r.status === "draft");
    if (q.has("mine")) list = list.filter((r) => r.mine);
    const st = search.fields.status ?? [];
    if (st.length) list = list.filter((r) => st.includes(STATUS_LABEL[r.status]));
    const dt = search.fields.document ?? [];
    if (dt.length) list = list.filter((r) => dt.includes(r.template?.name ?? ""));
    return list;
  }, [rows, uploads, view, type, search]);
  const result = useMemo(() => matchRows(filtered, SEARCH_FIELDS, search.q), [filtered, search.q]);

  const groups = useMemo(() => {
    const by = search.groupBy;
    if (!by || by === "none") return [{ key: "", rows: result.rows }];
    const m = new Map<string, Row[]>();
    for (const r of result.rows) {
      const k = by === "status" ? STATUS_LABEL[r.status] : by === "contact" ? r.contact?.company ?? r.contact?.name ?? "—" : r.template?.name ?? "—";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].map(([key, rows]) => ({ key, rows }));
  }, [result.rows, search.groupBy]);

  const docNames = useMemo(() => [...new Set(rows.map((r) => r.template?.name ?? "").filter(Boolean))].sort(), [rows]);
  const gear: GearItem[] = [
    {
      key: "csv",
      icon: "ti-download",
      label: "Export list (CSV)",
      onClick: () =>
        downloadCsv(
          "spv-contracts.csv",
          ["Document", "Version", "Contact", "Company", "Entity", "Sent", "Opens", "Last opened", "Status"],
          result.rows.map((r) => [r.template?.name, r.version, r.contact?.name, r.contact?.company, r.entity?.legal_name, r.sent_at, r.request?.open_count ?? 0, r.request?.last_opened_at, STATUS_LABEL[r.status]]),
        ),
    },
  ];

  const upGrid = "minmax(240px,2.4fr) minmax(150px,1.2fr) 150px 70px 80px";
  const grid = "minmax(220px,2fr) minmax(170px,1.5fr) minmax(130px,1.1fr) 60px 70px minmax(110px,1fr) 160px";
  const q = search.q;

  return (
    <div>
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "visible" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
          <NewButton onClick={() => setPicking(true)} />
          <button type="button" onClick={() => setUploading(true)} style={{ fontSize: 12.5, fontWeight: 600, color: "#185FA5", background: "#fff", border: "0.5px solid #B5D4F4", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>Upload</button>
          <div style={{ display: "flex", gap: 2 }}>
            {(["all", "uploaded"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} style={{ fontSize: 12.5, fontWeight: 600, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: view === v ? "#E6F1FB" : "transparent", color: view === v ? "#185FA5" : MUTED }}>
                {v === "all" ? "All" : "Uploaded"}
                {v === "uploaded" ? <span style={{ marginLeft: 5, fontSize: 10, background: "#185FA5", color: "#fff", borderRadius: 9, padding: "0 6px" }}>{uploads.length}</span> : null}
              </button>
            ))}
          </div>
          <ToolbarGear items={gear} heading="Contracts" />
          <SearchCount result={result} noun="documents" />
          <OdooSearchBar
            scope="spv_contracts"
            state={search}
            onChange={setSearch}
            quick={QUICK}
            fields={[
              { key: "status", label: "Status", options: Object.values(STATUS_LABEL) },
              { key: "document", label: "Document", options: docNames },
            ]}
            groups={GROUPS}
            noGroupId="none"
            placeholder="Search document, contact, company, entity…"
            width={520}
          />
        </div>

        {error ? <div style={{ padding: 14 }}><Notice tone="error">{error}</Notice></div> : null}

        {showDrafts && sends.length ? (
          <div style={{ borderBottom: "0.5px solid #eef1f5" }}>
            <div style={{ padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Saved sends · {sends.length}</div>
            {sends.map((d) => {
              const n = (d.term_sheet_id ? 1 : 0) + d.extra_ids.length + d.upload_ids.length;
              return (
                <Link key={d.contact_id} href={`/admin/sales/contracts/send?contact=${d.contact_id}&resume=1`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5, color: NAVY, textDecoration: "none", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.contact?.name ?? "Contact"}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{d.contact?.company ?? ""}</div>
                  </div>
                  <span style={{ fontSize: 12, color: MUTED }}>{n} {n === 1 ? "document" : "documents"}</span>
                  <span style={{ fontSize: 11, color: MUTED }}>saved {fmtPt(d.updated_at)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, background: "#FAEEDA", color: "#854F0B", borderRadius: 6, padding: "3px 8px" }}>Draft · Step {d.step}, {STEP_LABEL[d.step] ?? ""}</span>
                  <span style={{ color: "#1A6CE4", fontWeight: 600 }}>Resume ›</span>
                </Link>
              );
            })}
          </div>
        ) : null}

        {view === "uploaded" ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 14px", borderBottom: "0.5px solid #eef1f5" }}>
            {[{ key: "" as const, label: "All types" }, ...CONTRACT_TYPES].map((t) => {
              const n = t.key ? uploads.filter((r) => r.contract_type === t.key).length : uploads.length;
              const on = type === t.key;
              return (
                <button key={t.key || "all"} type="button" onClick={() => setType(t.key)} style={{ fontSize: 12.5, fontWeight: 600, borderRadius: 999, padding: "5px 12px", cursor: "pointer", border: `0.5px solid ${on ? "#185FA5" : "#e2e6ed"}`, background: on ? "#185FA5" : "#fff", color: on ? "#fff" : MUTED }}>
                  {t.label} <span style={{ opacity: 0.7, marginLeft: 3 }}>{n}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {view === "uploaded" ? (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 640 }}>
              <div style={{ display: "grid", gridTemplateColumns: upGrid, padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <div>Contract</div><div>Type</div><div>Uploaded</div><div>Pages</div><div />
              </div>
              {loading ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: MUTED }}>Loading…</p> : null}
              {!loading && result.rows.length === 0 ? (
                q ? (
                  <div style={{ padding: 14 }}><NoSearchMatches query={q} fields={SEARCH_FIELDS.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} /></div>
                ) : (
                  <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: MUTED, margin: 0 }}>{uploads.length ? "No uploaded contracts of this type." : "No uploaded contracts yet. Use Upload to add one."}</p>
                )
              ) : null}
              {result.rows.map((r) => (
                <Link key={r.id} href={`/admin/sales/contracts/${r.id}`} style={{ display: "grid", gridTemplateColumns: upGrid, padding: "11px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, color: NAVY, textDecoration: "none" }}>
                  <div style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Highlight text={r.template?.name} query={q} />
                    <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, background: "#FCEBEB", color: "#A32D2D", borderRadius: 4, padding: "1px 5px" }}>PDF</span>
                  </div>
                  <div><Highlight text={r.contract_type ? CONTRACT_TYPE_LABEL[r.contract_type] : "—"} query={q} /></div>
                  <div style={{ color: MUTED }}>{fmtDateTime(r.created_at)}</div>
                  <div style={{ color: MUTED }}>{r.page_count ?? "—"}</div>
                  <div style={{ color: "#1A6CE4", fontWeight: 600, textAlign: "right" }}>Select ›</div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 940 }}>
            <div style={{ display: "grid", gridTemplateColumns: grid, padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <div>Document</div><div>Contact</div><div>Entity</div><div>Ver.</div><div>Sent</div><div>Opened</div><div>Status</div>
            </div>
            {loading ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: MUTED }}>Loading…</p> : null}
            {!loading && rows.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: NAVY, margin: 0 }}>No contracts yet</p>
                <p style={{ fontSize: 12.5, color: MUTED, margin: "6px 0 0" }}>Use Upload to send your own contract PDF, or New to fill a term sheet or services agreement.</p>
              </div>
            ) : null}
            {!loading && rows.length > 0 && result.rows.length === 0 && q ? (
              <div style={{ padding: 14 }}>
                <NoSearchMatches query={q} fields={SEARCH_FIELDS.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} />
              </div>
            ) : null}
            {groups.map((g) => (
              <div key={g.key || "all"}>
                {g.key ? <div style={{ padding: "7px 14px", background: "#f6f8fc", fontSize: 11.5, fontWeight: 700, color: "#3a4a63", borderTop: "0.5px solid #eef1f5" }}>{g.key} <span style={{ color: MUTED, fontWeight: 400 }}>· {g.rows.length}</span></div> : null}
                {g.rows.map((r) => (
                  <Link key={r.id} href={`/admin/sales/contracts/${r.id}`} style={{ display: "grid", gridTemplateColumns: grid, padding: "11px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, color: NAVY, textDecoration: "none" }}>
                    <div style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Highlight text={r.template?.name} query={q} />
                      {(copyNo[r.id] ?? 1) > 1 ? <span style={{ color: MUTED, fontWeight: 400 }}> #{copyNo[r.id]}</span> : null}
                      {r.template?.kind === "upload" ? <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, background: "#FCEBEB", color: "#A32D2D", borderRadius: 4, padding: "1px 5px" }}>PDF</span> : null}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: r.contact ? undefined : MUTED }}>{r.contact ? <Highlight text={r.contact.name} query={q} /> : "Not chosen"}</div>
                      <div style={{ fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={r.contact?.company ?? r.contact?.email} query={q} /></div>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={r.entity?.short_name} query={q} /></div>
                    <div style={{ color: MUTED }}>v{r.version}</div>
                    <div style={{ color: MUTED }}>{fmtDate(r.sent_at)}</div>
                    <div style={{ fontSize: 12, color: r.request?.open_count ? "#1a7f43" : MUTED }} title={r.request?.last_opened_at ? `Last opened ${fmtDateTime(r.request.last_opened_at)}` : undefined}>
                      {r.sent_at ? `${r.request?.open_count ?? 0}×${r.request?.last_opened_at ? ` · ${fmtDate(r.request.last_opened_at)}` : ""}` : "—"}
                    </div>
                    <div><StatusPill status={r.status} archived={Boolean(r.archived_at)} /></div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
      {picking ? <ContactPicker onClose={() => setPicking(false)} /> : null}
      {uploading ? <UploadContractModal onClose={() => setUploading(false)} /> : null}
    </div>
  );
}
