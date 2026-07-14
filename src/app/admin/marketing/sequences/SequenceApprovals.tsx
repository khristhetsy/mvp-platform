"use client";

// Pending sequence batches awaiting human release. Release is gated: only users
// with manage_actions (or super_admin) see an active button; others see it locked.

import { useCallback, useEffect, useState } from "react";

interface PendingBatch {
  id: string; sequence_name: string; step_order: number; step_name: string | null;
  will_send_count: number; suppressed_count: number; skipped_count: number; created_at: string;
  approver_name: string | null;
}

export function SequenceApprovals({ canApprove }: { canApprove: boolean }) {
  const [batches, setBatches] = useState<PendingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketing/sequence-batches");
      setBatches(res.ok ? await res.json() : []);
    } catch { setBatches([]); }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch pending batches on mount
  useEffect(() => { void load(); }, [load]);

  async function release(id: string) {
    setBusy(id); setError(null); setMsg(null);
    try {
      const res = await fetch(`/api/marketing/sequence-batches/${id}/release`, { method: "POST" });
      // Parse defensively: a timeout or runtime error can return a non-JSON body.
      const text = await res.text();
      let data: { error?: string; sent?: number; failed?: number } = {};
      try { data = text ? JSON.parse(text) : {}; }
      catch {
        throw new Error(
          res.status === 504 || res.status === 502
            ? "The send timed out — this batch may be too large to release in one go. Try again, or split it into smaller sends."
            : `Release failed (${res.status}). The server returned an unexpected response.`,
        );
      }
      if (!res.ok) throw new Error(data.error ?? `Release failed (${res.status}).`);
      setMsg(`Released — ${data.sent ?? 0} sent${data.failed ? `, ${data.failed} failed` : ""}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Release failed.");
    } finally { setBusy(null); }
  }

  if (loading) return null;
  if (batches.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#92400E", marginBottom: 8 }}>
        Pending approval · {batches.length} {batches.length === 1 ? "batch" : "batches"}
      </div>
      {msg ? <p style={{ background: "#ECFDF5", border: "0.5px solid #A7F3D0", color: "#065F46", fontSize: 12, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>{msg}</p> : null}
      {error ? <p style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", color: "#991B1B", fontSize: 12, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>{error}</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {batches.map((b) => (
          <div key={b.id} style={{ border: "1px solid #F59E0B", background: "#FFFBEB", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>{b.sequence_name} · Step {b.step_order}{b.step_name ? ` · ${b.step_name}` : ""}</div>
              <div style={{ fontSize: 11, color: "#78350F" }}>
                {b.will_send_count.toLocaleString()} will send
                {b.suppressed_count ? ` · ${b.suppressed_count} suppressed` : ""}
                {b.skipped_count ? ` · ${b.skipped_count} skipped` : ""}
              </div>
            </div>
            {b.approver_name ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "#1A6CE4", background: "#EFF6FF", border: "0.5px solid #93C5FD", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>Assigned: {b.approver_name}</span> : null}
            {canApprove ? (
              <button onClick={() => release(b.id)} disabled={busy === b.id}
                style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "8px 14px", cursor: "pointer", opacity: busy === b.id ? 0.5 : 1 }}>
                {busy === b.id ? "Releasing…" : `Review & release ${b.will_send_count} →`}
              </button>
            ) : (
              <span style={{ fontSize: 11, color: "#78350F", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13 }}>🔒</span> Ask an approver or super admin to release
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
