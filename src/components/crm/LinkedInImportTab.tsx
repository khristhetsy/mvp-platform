"use client";

import { useMemo, useRef, useState } from "react";
import { parseLinkedInCsv, type LinkedInRow } from "@/lib/ingest/linkedin-csv";
import type { ScreenStatus } from "@/lib/ingest/email-screen";

const C = {
  navy: "#0A1A40", blue: "#1A6CE4", steel: "#185FA5", ink: "#16181D", inkSoft: "#5A6172",
  inkFaint: "#8A91A0", rule: "#E3E6EC", ruleFirm: "#C9CED8",
  pass: "#1D7A4F", passBg: "#E7F3EC", hold: "#9A6208", holdBg: "#FBF1DE",
  stop: "#A62D2D", stopBg: "#F9E9E9", idle: "#5A6172", idleBg: "#EDEFF3",
};

// Buckets shown BEFORE any mailbox verification. "screened" = passed the free checks
// (syntax + MX + not disposable/role) — NOT verified. Nothing here is mailable.
type Bucket = "screened" | "risky" | "invalid" | "duplicate" | "research";
type TriagedRow = LinkedInRow & { bucket: Bucket; reason: string };
type Filter = "all" | Bucket;

function bucketMeta(b: Bucket): { label: string; fg: string; bg: string; border: string } {
  switch (b) {
    case "screened": return { label: "Screened", fg: C.pass, bg: C.passBg, border: "#BCDDC9" };
    case "risky": return { label: "Risky", fg: C.hold, bg: C.holdBg, border: "#E6D3A8" };
    case "invalid": return { label: "Invalid", fg: C.stop, bg: C.stopBg, border: "#E5BFBF" };
    case "duplicate": return { label: "Already in CRM", fg: C.steel, bg: "#E8F0FB", border: "#BCD4F0" };
    default: return { label: "No email", fg: C.idle, bg: C.idleBg, border: C.ruleFirm };
  }
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function downloadCsv(rows: TriagedRow[], filename: string) {
  const header = ["First Name", "Last Name", "Email", "Company", "Title", "Profile URL", "Connected On", "Status"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.firstName, r.lastName, r.email, r.company, r.title, r.profileUrl, r.connectedOn, r.bucket]
      .map((v) => csvEscape(v ?? "")).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LinkedInImportTab() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<TriagedRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [dragging, setDragging] = useState(false);
  const [said, setSaid] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c = { total: rows?.length ?? 0, screened: 0, risky: 0, invalid: 0, duplicate: 0, research: 0 };
    for (const r of rows ?? []) c[r.bucket]++;
    return c;
  }, [rows]);

  async function handleFile(file: File) {
    setError(null); setBusy(true); setSaid("");
    try {
      const text = await file.text();
      const result = parseLinkedInCsv(text);
      if (result.error) { setError(result.error); setBusy(false); return; }
      if (result.total === 0) { setError("No connections found in this file."); setBusy(false); return; }

      // Read-only dedupe + free screening (syntax + MX + disposable/role).
      let existing = new Set<string>();
      let screen: Record<string, { status: ScreenStatus; reason: string }> = {};
      try {
        const emails = result.rows.map((r) => r.email).filter(Boolean);
        const res = await fetch("/api/admin/crm/linkedin/dedupe", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ emails }),
        });
        if (res.ok) {
          const d = await res.json();
          existing = new Set((d.existing as string[]) ?? []);
          screen = (d.screen as typeof screen) ?? {};
        }
      } catch { /* dedupe/screen is advisory — proceed without it */ }

      const triaged: TriagedRow[] = result.rows.map((r) => {
        if (!r.email) return { ...r, bucket: "research", reason: r.domain ? "No email in export" : "Profile only, no domain" };
        if (existing.has(r.email)) return { ...r, bucket: "duplicate", reason: "Matches a contact you already have" };
        const s = screen[r.email];
        const status = (s?.status ?? "screened") as ScreenStatus;
        const reason = s?.reason ?? "Syntax OK — not mailbox-verified";
        return { ...r, bucket: status, reason };
      });
      setFileName(file.name); setRows(triaged); setFilter("all");
    } catch {
      setError("Couldn't read that file. Make sure it's the Connections.csv from your LinkedIn data export.");
    } finally { setBusy(false); }
  }

  function reset() { setRows(null); setFileName(null); setError(null); setFilter("all"); setSaid(""); }
  function announce(m: string) { setSaid(m); window.clearTimeout((announce as unknown as { t?: number }).t); (announce as unknown as { t?: number }).t = window.setTimeout(() => setSaid(""), 4000) as unknown as number; }

  // ── Upload state ──────────────────────────────────────────────────────────
  if (!rows) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "#EAF1FB", color: C.blue }} aria-hidden>
            <i className="ti ti-brand-linkedin" style={{ fontSize: 20 }} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Import from LinkedIn</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-600">
              Upload your <b>Connections.csv</b> from LinkedIn (Settings &rarr; Data privacy &rarr; Get a copy of your data &rarr; Connections).
              We parse it, flag duplicates you already have, and screen each email for free — syntax, a live mail-server (MX) check, and disposable/role addresses.
            </p>
          </div>
        </div>

        <div
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
          className="mt-4 rounded-xl border-2 border-dashed px-5 py-10 text-center"
          style={{ borderColor: dragging ? C.blue : C.ruleFirm, background: dragging ? "#F0F6FF" : "#F8FAFC" }}
        >
          <p className="text-sm text-slate-700"><b>Drop Connections.csv here</b> or</p>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            className="mt-2 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: busy ? "#9DB4DE" : C.blue }}>
            {busy ? "Reading & screening…" : "Choose file"}
          </button>
          <p className="mt-2 text-xs text-slate-500">CSV up to a few thousand rows · parsing is in your browser; only a duplicate + domain check hits the server</p>
          <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
        </div>

        {error && <div className="mt-4 rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "#E5BFBF", background: C.stopBg, color: C.stop }}>{error}</div>}

        <div className="mt-4 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed" style={{ background: "#F5F6F8", color: C.inkSoft }}>
          <b style={{ color: C.ink }}>What this does — and doesn&apos;t.</b> Screening is free and catches malformed addresses, dead domains, and
          disposable/role addresses. It <b>cannot</b> confirm a mailbox exists — that needs paid verification. So &quot;Screened&quot; means
          <i> likely deliverable</i>, not guaranteed. Nothing is added to your contacts and nothing is mailed here.
        </div>
      </div>
    );
  }

  // ── Review state ──────────────────────────────────────────────────────────
  const visible = rows.filter((r) => filter === "all" || r.bucket === filter);
  const screenedRows = rows.filter((r) => r.bucket === "screened");
  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 1000) / 10 : 0);

  const seg = (b: Bucket, bg: string, fg: string) =>
    counts[b] > 0 ? <div style={{ width: `${pct(counts[b])}%`, background: bg, color: fg, borderLeft: `1px solid ${C.ruleFirm}` }} className="flex items-center justify-center text-[12px]" title={`${bucketMeta(b).label}: ${counts[b]}`}>{counts[b]}</div> : null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">LinkedIn import — review</h2>
          <p className="mt-0.5 text-sm text-slate-600">{fileName} · <span style={{ fontFamily: "monospace" }}>{counts.total.toLocaleString()}</span> connections</p>
        </div>
        <button type="button" onClick={reset} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900" style={{ borderColor: C.ruleFirm }}>Import another file</button>
      </div>

      {/* Disposition */}
      <div className="mb-4">
        <div className="mb-2 flex items-baseline gap-2.5">
          <strong style={{ fontFamily: "Archivo, sans-serif", fontSize: 34, fontWeight: 600, lineHeight: 1, color: C.pass }}>{screenedRows.length.toLocaleString()}</strong>
          <span className="text-sm text-slate-600">screened (likely deliverable, not yet verified)</span>
          <span className="ml-auto text-xs" style={{ fontFamily: "monospace", color: C.inkFaint }}>{pct(screenedRows.length)}%</span>
        </div>
        <div className="flex h-7 overflow-hidden border" style={{ borderColor: C.ruleFirm }}>
          {seg("screened", C.passBg, C.pass)}
          {seg("risky", C.holdBg, C.hold)}
          {seg("invalid", C.stopBg, C.stop)}
          {seg("duplicate", "#E8F0FB", C.steel)}
          {seg("research", C.idleBg, C.idle)}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-slate-600">
          {(["screened", "risky", "invalid", "duplicate", "research"] as const).map((b) => (
            <span key={b}><span className="mr-1.5 inline-block h-2.5 w-2.5 border align-middle" style={{ background: bucketMeta(b).bg, borderColor: C.ruleFirm }} />{bucketMeta(b).label} {counts[b]}</span>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-y py-3" style={{ borderColor: C.rule }}>
        {([["all", "All", counts.total], ["screened", "Screened", counts.screened], ["risky", "Risky", counts.risky], ["invalid", "Invalid", counts.invalid], ["duplicate", "In CRM", counts.duplicate], ["research", "No email", counts.research]] as const).map(([f, label, n]) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
            className="rounded-full border px-3 py-1 text-[13px]"
            style={filter === f ? { background: C.navy, borderColor: C.navy, color: "#fff" } : { borderColor: C.ruleFirm, color: C.inkSoft, background: "transparent" }}>
            {label} <span style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.75, marginLeft: 4 }}>{n.toLocaleString()}</span>
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" onClick={() => { downloadCsv(screenedRows, "linkedin-screened.csv"); announce(`Exported ${screenedRows.length} screened rows.`); }} disabled={screenedRows.length === 0}
          className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: C.ruleFirm, color: screenedRows.length ? C.ink : C.inkFaint }}>Export screened</button>
        <button type="button" onClick={() => { downloadCsv(visible, "linkedin-view.csv"); announce(`Exported ${visible.length} rows.`); }} disabled={visible.length === 0}
          className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: C.ruleFirm, color: visible.length ? C.ink : C.inkFaint }}>Export current view</button>
      </div>

      {/* Rows */}
      <div className="border border-t-0" style={{ borderColor: C.rule }}>
        {visible.slice(0, 500).map((r, i) => {
          const m = bucketMeta(r.bucket);
          return (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-1.5 border-b px-4 py-3 last:border-b-0" style={{ borderColor: C.rule }}>
              <div className="min-w-0">
                <p className="m-0 text-sm font-medium text-slate-900">{r.name}
                  {(r.company || r.title) && <small className="ml-2 text-[13px] font-normal" style={{ color: C.inkFaint }}>{[r.company, r.title].filter(Boolean).join(" · ")}</small>}
                </p>
                {r.email
                  ? <p className="m-0 mt-0.5 truncate text-[13px]" style={{ fontFamily: "monospace", color: C.steel }}>{r.email}</p>
                  : <p className="m-0 mt-0.5 text-[13px] italic" style={{ color: C.inkFaint }}>No email in export</p>}
              </div>
              <span className="self-start whitespace-nowrap border px-2.5 py-0.5 text-[12px] font-medium" style={{ background: m.bg, color: m.fg, borderColor: m.border }}>{m.label}</span>
              <p className="col-span-2 m-0 text-[13px]" style={{ color: C.inkSoft }}>{r.reason}</p>
            </div>
          );
        })}
        {visible.length > 500 && <div className="px-4 py-3 text-[13px] text-slate-500">Showing first 500 of {visible.length.toLocaleString()}. Export to see them all.</div>}
        {visible.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-500">No rows in this filter.</div>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4" style={{ borderColor: C.rule }}>
        {said && <span className="text-[13px]" style={{ color: C.pass }} role="status">{said}</span>}
        <p className="max-w-[54ch] text-[13px]" style={{ color: C.inkSoft }}>
          <b style={{ color: C.ink }}>Nothing has been added to your contacts.</b> &quot;Screened&quot; means the domain accepts mail and the address
          looks real — not that the mailbox exists. Promote-to-contacts turns on once real mailbox verification is connected.
        </p>
      </div>
    </div>
  );
}
