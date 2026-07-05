"use client";

// Per-sequence approver picker. Assigns who a sequence's pending batches route to.
// Release stays permission-gated; this just sets the assignee.

import { useEffect, useState } from "react";

interface Approver { id: string; name: string }

export function ApproverPicker({ sequenceId, initialApproverId }: { sequenceId: string; initialApproverId: string | null }) {
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [value, setValue] = useState(initialApproverId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/marketing/approvers").then((r) => (r.ok ? r.json() : [])).then((d) => setApprovers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function change(next: string) {
    setValue(next); setSaving(true);
    try {
      await fetch(`/api/marketing/sequences/${sequenceId}/approver`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: next || null }),
      });
    } finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>Approver:</span>
      <select value={value} onChange={(e) => change(e.target.value)} disabled={saving}
        style={{ fontSize: 11, border: "0.5px solid var(--border)", borderRadius: 6, padding: "4px 7px", background: "var(--background)", color: "var(--foreground)" }}>
        <option value="">Anyone with permission</option>
        {approvers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </div>
  );
}
