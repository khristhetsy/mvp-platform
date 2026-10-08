"use client";

/**
 * Sales › Scheduled emails. Everything the signed in person scheduled from a
 * send point (Contracts, Gmail, Draft email, CRM record, Investor Relations,
 * Sales chatter, Mass email): Send now, Change time and Cancel while pending,
 * Retry when a send failed. Filters client side like the other admin lists.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { ToolbarGear, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import { OdooPager } from "@/components/admin/OdooPager";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { RescheduleButton } from "@/components/email/ScheduleSend";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { formatSendAt } from "@/lib/scheduled-emails/time";

type Status = "scheduled" | "sending" | "sent" | "failed" | "canceled";
type Row = { id: string; kind: string; to_label: string; subject: string; send_at: string; status: Status; attempts: number; sent_at: string | null; error: string | null; created_at: string };

const MUTED = "#5a6b87";
const NAVY = "#0A1A40";
const PAGE = 50;

const SOURCE: Record<string, string> = {
  contracts: "Contracts",
  gmail_send: "Gmail",
  gmail_reply: "Gmail reply",
  ir_match_email: "Investor Relations",
  sales_chatter: "Sales chatter",
  mass_email: "Mass email",
};
const STATUS_LABEL: Record<Status, string> = { scheduled: "Scheduled", sending: "Sending", sent: "Sent", failed: "Failed", canceled: "Canceled" };
const STATUS_TONE: Record<Status, { bg: string; fg: string }> = {
  scheduled: { bg: "#FAEEDA", fg: "#854F0B" },
  sending: { bg: "#E6F1FB", fg: "#0C447C" },
  sent: { bg: "#EAF3DE", fg: "#3B6D11" },
  failed: { bg: "#FCEBEB", fg: "#A32D2D" },
  canceled: { bg: "#F1EFE8", fg: "#5F5E5A" },
};

const QUICK = [
  { key: "pending", label: "Scheduled" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
  { key: "canceled", label: "Canceled" },
];
const GROUPS = [
  { id: "none", label: "None" },
  { id: "status", label: "Status" },
  { id: "source", label: "Source" },
];
const SEARCH_FIELDS: SearchField<Row>[] = [
  { label: "to", get: (r) => r.to_label },
  { label: "subject", get: (r) => r.subject },
  { label: "source", get: (r) => SOURCE[r.kind] ?? r.kind },
  { label: "status", get: (r) => STATUS_LABEL[r.status] },
  { label: "error", get: (r) => r.error },
];

export function ScheduledEmailsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, quick: ["pending"], groupBy: "none" });
  const [page, setPage] = useState(1);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/scheduled-emails?status=all&limit=1000")
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as { rows?: Row[]; error?: string };
        if (!live) return;
        if (!r.ok) setError(d.error ?? "Couldn't load scheduled emails.");
        else { setError(null); setRows(d.rows ?? []); }
      })
      .catch(() => { if (live) setError("Couldn't load scheduled emails."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tick]);

  async function act(id: string, action: "send_now" | "retry" | "cancel") {
    setBusy(id);
    setRowError(null);
    try {
      const r = await fetch(`/api/admin/scheduled-emails/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setRowError({ id, text: d.error ?? "That didn't work. Try again." });
      }
    } finally {
      setBusy(null);
      load();
    }
  }

  const filtered = useMemo(() => {
    let list = rows;
    const q = new Set(search.quick);
    if (q.size) {
      list = list.filter((r) =>
        (q.has("pending") && (r.status === "scheduled" || r.status === "sending")) ||
        (q.has("sent") && r.status === "sent") ||
        (q.has("failed") && r.status === "failed") ||
        (q.has("canceled") && r.status === "canceled"));
    }
    const src = search.fields.source ?? [];
    if (src.length) list = list.filter((r) => src.includes(SOURCE[r.kind] ?? r.kind));
    return list;
  }, [rows, search]);
  const result = useMemo(() => matchRows(filtered, SEARCH_FIELDS, search.q), [filtered, search.q]);
  const pages = Math.max(1, Math.ceil(result.rows.length / PAGE));
  const cur = Math.min(page, pages);
  const shown = result.rows.slice((cur - 1) * PAGE, cur * PAGE);

  const groups = useMemo(() => {
    const by = search.groupBy;
    if (!by || by === "none") return [{ key: "", rows: shown }];
    const m = new Map<string, Row[]>();
    for (const r of shown) {
      const k = by === "status" ? STATUS_LABEL[r.status] : SOURCE[r.kind] ?? r.kind;
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].map(([key, rows]) => ({ key, rows }));
  }, [shown, search.groupBy]);

  const gear: GearItem[] = [
    {
      key: "csv",
      icon: "ti-download",
      label: "Export list (CSV)",
      onClick: () =>
        downloadCsv(
          "scheduled-emails.csv",
          ["To", "Subject", "Source", "Send time (PT)", "Status", "Sent at", "Error"],
          result.rows.map((r) => [r.to_label, r.subject, SOURCE[r.kind] ?? r.kind, formatSendAt(r.send_at), STATUS_LABEL[r.status], r.sent_at ? formatSendAt(r.sent_at) : "", r.error ?? ""]),
        ),
    },
  ];

  const grid = "minmax(160px,1.3fr) minmax(200px,2fr) 130px 170px minmax(220px,1.4fr)";
  const q = search.q;
  const from = result.rows.length ? (cur - 1) * PAGE + 1 : 0;
  const to = Math.min(cur * PAGE, result.rows.length);
  const link: React.CSSProperties = { border: "none", background: "none", padding: 0, color: "#1A6CE4", cursor: "pointer", fontSize: 12, fontWeight: 600, marginRight: 12 };

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "visible" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>Scheduled emails</span>
        <ToolbarGear items={gear} heading="Scheduled emails" />
        <SearchCount result={result} noun="emails" />
        <OdooSearchBar
          scope="scheduled_emails"
          state={search}
          onChange={(next) => { setSearch(next); setPage(1); }}
          quick={QUICK}
          fields={[{ key: "source", label: "Source", options: Object.values(SOURCE) }]}
          groups={GROUPS}
          noGroupId="none"
          placeholder="Search to, subject, source, status…"
          width={480}
        />
        <span style={{ marginLeft: "auto" }}>
          <OdooPager label={`${from}–${to} / ${result.rows.length.toLocaleString()}`}
            prev={{ onClick: () => setPage(cur - 1), disabled: cur <= 1 }}
            next={{ onClick: () => setPage(cur + 1), disabled: cur >= pages }} />
        </span>
      </div>

      {error ? <p role="alert" style={{ margin: 0, padding: 14, fontSize: 12.5, color: "#A32D2D" }}>{error}</p> : null}

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 860 }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, gap: 10, padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <div>To</div><div>Subject</div><div>Source</div><div>Send time</div><div>Status</div>
          </div>
          {loading ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: MUTED }}>Loading…</p> : null}
          {!loading && result.rows.length === 0 ? (
            q ? <div style={{ padding: 14 }}><NoSearchMatches query={q} fields={SEARCH_FIELDS.map((f) => f.label)} onClear={() => { setSearch({ ...search, q: "" }); setPage(1); }} /></div>
              : <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: MUTED }}>Use the arrow beside any Send button to schedule an email. It shows here until it sends.</p>
          ) : null}
          {groups.map((g) => (
            <div key={g.key || "all"}>
              {g.key ? <div style={{ padding: "7px 14px", background: "#f6f8fc", borderTop: "0.5px solid #eef1f5", fontSize: 11.5, fontWeight: 600, color: NAVY }}>{g.key} · {g.rows.length}</div> : null}
              {g.rows.map((r) => {
                const tone = STATUS_TONE[r.status];
                return (
                  <div key={r.id} style={{ display: "grid", gridTemplateColumns: grid, gap: 10, alignItems: "center", padding: "10px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5, color: NAVY }}>
                    <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={r.to_label || "—"} query={q} /></div>
                    <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={r.subject || "(no subject)"} query={q} /></div>
                    <div style={{ color: MUTED }}><Highlight text={SOURCE[r.kind] ?? r.kind} query={q} /></div>
                    <div>
                      {formatSendAt(r.status === "sent" && r.sent_at ? r.sent_at : r.send_at)}
                    </div>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: tone.bg, color: tone.fg, marginRight: 10 }}>{STATUS_LABEL[r.status]}</span>
                      {r.status === "scheduled" ? (
                        <>
                          <button type="button" disabled={busy === r.id} style={link} onClick={() => void act(r.id, "send_now")}>{busy === r.id ? "Sending…" : "Send now"}</button>
                          <RescheduleButton id={r.id} style={link} onChanged={() => load()} />
                          <button type="button" disabled={busy === r.id} style={link} onClick={() => void act(r.id, "cancel")}>Cancel</button>
                        </>
                      ) : null}
                      {r.status === "failed" ? (
                        <>
                          <button type="button" disabled={busy === r.id} style={link} onClick={() => void act(r.id, "retry")}>{busy === r.id ? "Sending…" : "Retry"}</button>
                          <button type="button" disabled={busy === r.id} style={link} onClick={() => void act(r.id, "cancel")}>Cancel</button>
                        </>
                      ) : null}
                      {r.error ? <div style={{ fontSize: 11.5, color: r.status === "sent" ? "#854F0B" : "#A32D2D", marginTop: 4, whiteSpace: "normal" }}><Highlight text={r.error} query={q} /></div> : null}
                      {rowError?.id === r.id ? <div role="alert" style={{ fontSize: 11.5, color: "#A32D2D", marginTop: 4 }}>{rowError.text}</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
