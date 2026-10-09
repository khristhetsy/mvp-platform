"use client";

import { useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { WorkspaceSection } from "@/components/admin/company-workspace/WorkspaceSection";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { ToolbarGear, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import type { CompanyNoticeStats, NoticeCounts } from "@/lib/listing/deal-notice-admin";

type Stats = { totals: NoticeCounts; companies: CompanyNoticeStats[]; loadedAt: string };
type SendResult = { sent: number; skipped: number; failed: number; remaining: number };
type Run = {
  scope: string; // "all" or a company id
  batch: number;
  sent: number;
  skipped: number;
  failed: number;
  remaining: number | null;
  running: boolean;
  error: string | null;
};

const MAX_BATCHES = 5;
const PT = "America/Los_Angeles";

function ptDate(iso: string | null): string {
  if (!iso) return "Not listed";
  return `${new Date(iso).toLocaleDateString("en-US", { timeZone: PT, month: "short", day: "numeric", year: "numeric" })} PT`;
}

function ptTime(iso: string): string {
  return `${new Date(iso).toLocaleString("en-US", { timeZone: PT, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} PT`;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

const btn = (kind: "primary" | "ghost"): React.CSSProperties => ({
  padding: "5px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
  border: kind === "ghost" ? "0.5px solid var(--border-strong, #cbd5e1)" : "none",
  background: kind === "primary" ? "#1A6CE4" : "#fff",
  color: kind === "primary" ? "#fff" : "var(--foreground)",
});

const FIELDS: SearchField<CompanyNoticeStats>[] = [
  { label: "company", get: (r) => r.companyName },
  { label: "listed date", get: (r) => ptDate(r.listedAt) },
  { label: "queued", get: (r) => r.queued },
  { label: "sent", get: (r) => r.sent },
  { label: "viewed", get: (r) => r.viewed },
  { label: "opted in", get: (r) => r.optedIn },
];

export function DealNoticesClient({ initial, loadError }: Readonly<{ initial: Stats | null; loadError: string | null }>) {
  const [stats, setStats] = useState<Stats | null>(initial);
  const [error, setError] = useState<string | null>(loadError);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [run, setRun] = useState<Run | null>(null);
  const [rematch, setRematch] = useState<{ companyId: string; running: boolean; message: string | null } | null>(null);

  async function reload() {
    try {
      const res = await fetch("/api/admin/marketing/deal-notices", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Could not reload deal notices.");
      setStats(payload as Stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reload deal notices.");
    }
  }

  /** Sends batches of 100 until nothing is queued or 5 batches have run. */
  async function send(companyId: string | null) {
    const scope = companyId ?? "all";
    let acc: Run = { scope, batch: 0, sent: 0, skipped: 0, failed: 0, remaining: null, running: true, error: null };
    setRun(acc);
    setError(null);
    for (let i = 0; i < MAX_BATCHES; i++) {
      try {
        const res = await fetch("/api/admin/marketing/deal-notices/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(companyId ? { companyId } : {}),
        });
        const payload = (await res.json().catch(() => ({}))) as Partial<SendResult> & { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Send failed.");
        acc = {
          ...acc,
          batch: i + 1,
          sent: acc.sent + (payload.sent ?? 0),
          skipped: acc.skipped + (payload.skipped ?? 0),
          failed: acc.failed + (payload.failed ?? 0),
          remaining: payload.remaining ?? 0,
        };
        setRun(acc);
        const handled = (payload.sent ?? 0) + (payload.skipped ?? 0) + (payload.failed ?? 0);
        if (!acc.remaining || handled === 0) break;
      } catch (e) {
        acc = { ...acc, error: e instanceof Error ? e.message : "Send failed." };
        break;
      }
    }
    setRun({ ...acc, running: false });
    await reload();
  }

  async function doRematch(companyId: string) {
    setRematch({ companyId, running: true, message: null });
    try {
      const res = await fetch("/api/admin/marketing/deal-notices/rematch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const payload = (await res.json().catch(() => ({}))) as { added?: number; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Rematch failed.");
      const added = payload.added ?? 0;
      setRematch({ companyId, running: false, message: added ? `${added} new ${added === 1 ? "match" : "matches"} queued` : "No new matches" });
      await reload();
    } catch (e) {
      setRematch({ companyId, running: false, message: e instanceof Error ? e.message : "Rematch failed." });
    }
  }

  const rows = useMemo(() => stats?.companies ?? [], [stats]);
  const quick = search.quick;
  const preFiltered = rows.filter(
    (r) => (!quick.includes("queued") || r.queued > 0) && (!quick.includes("opted") || r.optedIn > 0) && (!quick.includes("none") || r.total === 0),
  );
  const result = matchRows(preFiltered, FIELDS, search.q);
  const busy = Boolean(run?.running) || Boolean(rematch?.running);
  const t = stats?.totals;

  const runLine = run ? (
    <span style={{ fontSize: 12, color: run.error ? "#A32D2D" : "var(--muted-foreground)" }}>
      {run.running ? `Sending batch ${run.batch + 1} of up to ${MAX_BATCHES}… ` : `Done after ${run.batch} ${run.batch === 1 ? "batch" : "batches"}: `}
      {run.sent} sent, {run.skipped} skipped, {run.failed} failed
      {run.remaining != null ? `, ${run.remaining} still queued` : ""}
      {run.scope !== "all" ? ` for ${rows.find((r) => r.companyId === run.scope)?.companyName ?? "this company"}` : ""}
      {run.error ? `. ${run.error}` : ""}
    </span>
  ) : null;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <ToolbarGear heading="Deal notices" items={[
          {
            key: "export", icon: "ti-download", label: "Export all", hint: `${result.rows.length} matching`,
            onClick: () => downloadCsv(
              `deal-notices-${new Date().toISOString().slice(0, 10)}.csv`,
              ["Company", "Listed (PT)", "Matched", "Queued", "Sent", "Skipped", "Failed", "Viewed", "Opted in"],
              result.rows.map((r) => [r.companyName, ptDate(r.listedAt), r.total, r.queued, r.sent, r.skipped, r.failed, r.viewed, r.optedIn]),
            ),
          } as GearItem,
        ]} />
        <div>
          <h1 style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", margin: 0 }}>Deal notices</h1>
          <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
            Emails to matched investors when a company completes its listing{stats ? ` · loaded ${ptTime(stats.loadedAt)}` : ""}
          </div>
        </div>
        <OdooSearchBar scope="marketing_deal_notices" state={search} onChange={setSearch}
          quick={[
            { key: "queued", label: "Has queued notices" },
            { key: "opted", label: "Has opt ins" },
            { key: "none", label: "No matches yet" },
          ]}
          fields={[]} groups={[{ id: "none", label: "None" }]} noGroupId="none"
          placeholder="Search company or listed date…" width={420} />
      </div>

      {error ? <p style={{ fontSize: 12, color: "#A32D2D", margin: 0 }}>{error}</p> : null}

      {t ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          <MetricCard
            audience="admin"
            label="Queued"
            value={t.queued.toLocaleString()}
            unit={`of ${t.total.toLocaleString()} matched`}
            detail={`${t.skipped} skipped, ${t.failed} failed · listing_deal_notices`}
            ring={{ percent: pct(t.queued, t.total), pending: t.total === 0 }}
            flag={t.queued > 0 ? { text: "Waiting for Send queued", tone: "warn" } : null}
          />
          <MetricCard
            audience="admin"
            label="Sent"
            value={t.sent.toLocaleString()}
            unit={`of ${t.total.toLocaleString()} matched`}
            detail="Deal notice emails delivered to the email provider"
            ring={{ percent: pct(t.sent, t.total), pending: t.total === 0 }}
            flag={t.failed > 0 ? { text: `${t.failed} failed to send`, tone: "bad" } : null}
          />
          <MetricCard
            audience="admin"
            label="Viewed"
            value={t.viewed.toLocaleString()}
            unit={`of ${t.sent.toLocaleString()} sent`}
            detail="Investors who opened the deal page from their email"
            ring={{ percent: pct(t.viewed, t.sent), pending: t.sent === 0 }}
          />
          <MetricCard
            audience="admin"
            label="Opted in"
            value={t.optedIn.toLocaleString()}
            unit={`of ${t.viewed.toLocaleString()} viewed`}
            detail="Clicked View the full deal, which starts a free investor account"
            ring={{ percent: pct(t.optedIn, t.viewed), pending: t.viewed === 0 }}
          />
        </div>
      ) : null}

      <WorkspaceSection
        icon="ti-mail-forward"
        title="Companies"
        subtitle="Each listed company and its matched investors"
        action={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {runLine}
            {t && t.queued > 0 ? (
              <span style={{ fontSize: 11, fontWeight: 600, background: "#FAEEDA", color: "#854F0B", padding: "2px 8px", borderRadius: 20 }}>{t.queued} queued</span>
            ) : null}
            <button type="button" style={{ ...btn("primary"), opacity: busy || !t?.queued ? 0.55 : 1 }} disabled={busy || !t?.queued} onClick={() => send(null)}>
              {run?.running && run.scope === "all" ? "Sending…" : "Send queued"}
            </button>
          </span>
        }
      >
        {!stats ? null : rows.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, padding: "40px 0" }}>
            No company has completed its listing yet. Notices are queued when a founder finishes all four listing checks.
          </div>
        ) : (
          <>
            <SearchCount result={result} noun="companies" className="mb-2" />
            {result.rows.length === 0 && result.active ? (
              <NoSearchMatches query={search.q} fields={FIELDS.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} />
            ) : result.rows.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, padding: "32px 0" }}>No companies in this view.</div>
            ) : (
              <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: 10, background: "#fff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "var(--muted)", color: "var(--muted-foreground)", textAlign: "left" }}>
                      {["Company", "Listed", "Queued", "Sent", "Viewed", "Opted in", ""].map((h, i) => (
                        <th key={h || i} style={{ padding: "8px 12px", fontWeight: 600, fontSize: 11, textAlign: i >= 2 && i <= 5 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => {
                      const rm = rematch?.companyId === r.companyId ? rematch : null;
                      return (
                        <tr key={r.companyId} style={{ borderTop: "0.5px solid var(--border)" }}>
                          <td style={{ padding: "9px 12px", fontWeight: 500 }}>
                            <Highlight text={r.companyName} query={search.q} />
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 400 }}>
                              {r.total} matched{r.skipped || r.failed ? ` · ${r.skipped} skipped, ${r.failed} failed` : ""}
                              {rm?.message ? ` · ${rm.message}` : ""}
                            </div>
                          </td>
                          <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}><Highlight text={ptDate(r.listedAt)} query={search.q} /></td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.queued}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.sent}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.viewed}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.optedIn}</td>
                          <td style={{ padding: "9px 12px" }}>
                            <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button type="button" style={{ ...btn("ghost"), opacity: busy ? 0.55 : 1 }} disabled={busy} onClick={() => doRematch(r.companyId)}>
                                {rm?.running ? "Matching…" : "Rematch"}
                              </button>
                              {r.queued > 0 ? (
                                <button type="button" style={{ ...btn("primary"), opacity: busy ? 0.55 : 1 }} disabled={busy} onClick={() => send(r.companyId)}>
                                  {run?.running && run.scope === r.companyId ? "Sending…" : "Send for this company"}
                                </button>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </WorkspaceSection>
    </div>
  );
}
