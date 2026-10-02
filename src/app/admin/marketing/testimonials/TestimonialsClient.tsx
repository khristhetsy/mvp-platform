"use client";

import { useState } from "react";
import { OdooSearchBar, EMPTY_SEARCH, textMatch, type SearchState } from "@/components/admin/OdooSearchBar";
import { ToolbarGear, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import type { TestimonialRow } from "@/lib/testimonials/map";

type Status = TestimonialRow["status"];

const STATUS_STYLE: Record<Status, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#FAEEDA", fg: "#854F0B", label: "Pending" },
  approved: { bg: "#EAF3DE", fg: "#3B6D11", label: "Approved" },
  declined: { bg: "#F1EFE8", fg: "#5F5E5A", label: "Declined" },
};

const btn = (kind: "approve" | "decline" | "ghost"): React.CSSProperties => ({
  padding: "5px 12px", fontSize: 12, fontWeight: 500, borderRadius: 6, border: kind === "ghost" ? "0.5px solid var(--border)" : "none", cursor: "pointer",
  background: kind === "approve" ? "#2E78F5" : kind === "decline" ? "#FCEBEB" : "#fff",
  color: kind === "approve" ? "#fff" : kind === "decline" ? "#A32D2D" : "var(--foreground)",
});

export function TestimonialsClient({ initial, minToShow }: { initial: TestimonialRow[]; minToShow: number }) {
  const [rows, setRows] = useState(initial);
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, quick: ["pending"] });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quick = search.quick;
  const statusFilter = (["pending", "approved", "declined"] as Status[]).filter((s) => quick.includes(s));
  const visible = rows
    .filter((r) => statusFilter.length === 0 || statusFilter.includes(r.status))
    .filter((r) => textMatch(search.q, r.name, r.email, r.company_name, r.quote));
  const approvedCount = rows.filter((r) => r.status === "approved").length;

  async function setStatus(id: string, status: Status) {
    setBusy(id + status);
    setError(null);
    try {
      const res = await fetch("/api/marketing/testimonials", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Update failed");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status, reviewed_at: new Date().toISOString() } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  const count = (s: Status) => rows.filter((r) => r.status === s).length;

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <ToolbarGear heading="Testimonials" items={[
          { key: "export", icon: "ti-download", label: "Export all", hint: `${visible.length} matching`, onClick: () => downloadCsv(`testimonials-${new Date().toISOString().slice(0, 10)}.csv`, ["Status", "Name", "Email", "Title", "Company", "Anonymous", "Show score", "CRR start", "CRR current", "Quote", "Consent at", "Submitted"], visible.map((r) => [r.status, r.name, r.email, r.title ?? "", r.company_name ?? "", r.anonymous ? "yes" : "", r.show_score ? "yes" : "", r.crr_start ?? "", r.crr_current ?? "", r.quote, r.consent_at, r.created_at])) } as GearItem,
        ]} />
        <div>
          <h1 style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", margin: 0 }}>Founder testimonials</h1>
          <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
            {approvedCount} approved · homepage section shows at {minToShow}{approvedCount >= minToShow ? " (live)" : ""}
          </div>
        </div>
        <OdooSearchBar scope="marketing_testimonials" state={search} onChange={setSearch}
          quick={[
            { key: "pending", label: `Pending (${count("pending")})` },
            { key: "approved", label: `Approved (${count("approved")})` },
            { key: "declined", label: `Declined (${count("declined")})` },
          ]}
          fields={[]} groups={[{ id: "none", label: "None" }]} noGroupId="none"
          placeholder="Search name, company or quote…" width={440} />
      </div>

      {error ? <p style={{ fontSize: 12, color: "#A32D2D", margin: "0 0 10px" }}>{error}</p> : null}

      {visible.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, padding: "48px 0" }}>
          {rows.length === 0 ? "No submissions yet. Founders submit from the link in the testimonial request email." : "No testimonials match this view."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((r) => {
            const st = STATUS_STYLE[r.status];
            const score = r.show_score && r.crr_start != null && r.crr_current != null;
            return (
              <div key={r.id} style={{ border: "0.5px solid var(--border)", borderRadius: 10, padding: "14px 16px", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ background: st.bg, color: st.fg, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{st.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{[r.title, r.company_name].filter(Boolean).join(", ")} · {r.email}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 13.5, lineHeight: 1.6, color: "var(--foreground)" }}>&ldquo;{r.quote}&rdquo;</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
                    Shown as: {r.anonymous ? "Anonymous" : "Named"} · {score ? `CRR ${r.crr_start} → ${r.crr_current}` : "Score hidden"} · Consent {new Date(r.consent_at).toLocaleDateString()}
                  </span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    {r.status !== "approved" ? (
                      <button type="button" style={{ ...btn("approve"), opacity: busy === r.id + "approved" ? 0.6 : 1 }} disabled={busy !== null} onClick={() => setStatus(r.id, "approved")}>Approve</button>
                    ) : null}
                    {r.status !== "declined" ? (
                      <button type="button" style={{ ...btn("decline"), opacity: busy === r.id + "declined" ? 0.6 : 1 }} disabled={busy !== null} onClick={() => setStatus(r.id, "declined")}>{r.status === "approved" ? "Unpublish" : "Decline"}</button>
                    ) : null}
                    {r.status === "declined" ? (
                      <button type="button" style={btn("ghost")} disabled={busy !== null} onClick={() => setStatus(r.id, "pending")}>Back to pending</button>
                    ) : null}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
