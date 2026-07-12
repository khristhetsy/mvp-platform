"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketingSequence, MarketingTemplate, MarketingList } from "@/lib/marketing/types";
import { ApproverPicker } from "./ApproverPicker";

interface Props { sequences: MarketingSequence[]; templates: MarketingTemplate[]; lists: MarketingList[]; }

// Display labels for all stored conditions (existing steps may use any).
const conditionLabels: Record<string, string> = {
  always:   "Always send",
  no_open:  "If not opened",
  no_click: "If not clicked",
  no_reply: "If no reply",
};

// Conditions offered when creating a step. "no_reply" is excluded: Resend
// webhooks don't report inbound replies, so it can't be detected and would
// silently behave like "always send".
const selectableConditions: Array<[string, string]> = [
  ["always", conditionLabels.always],
  ["no_open", conditionLabels.no_open],
  ["no_click", conditionLabels.no_click],
];

const statusColors: Record<string, { bg: string; color: string }> = {
  draft:    { bg: "#F1EFE8", color: "#5F5E5A" },
  active:   { bg: "#E1F5EE", color: "#0F6E56" },
  paused:   { bg: "#FAEEDA", color: "#854F0B" },
  archived: { bg: "#FCEBEB", color: "#A32D2D" },
};

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "0.5px solid #e2e6ed",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
};

export function SequencesClient({ sequences, templates, lists }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingStep, setAddingStep] = useState<string | null>(null);
  // Per-sequence enroll-list selection + message, keyed by sequence id, so choosing
  // a list on one sequence never changes another's.
  const [enrollListId, setEnrollListId] = useState<Record<string, string>>({});
  const [enrollMsg, setEnrollMsg] = useState<Record<string, string>>({});
  const listForSeq = (sequenceId: string) => enrollListId[sequenceId] ?? lists[0]?.id ?? "";

  async function handleEnrollList(sequenceId: string) {
    const listId = listForSeq(sequenceId);
    if (!listId) return;
    setEnrollMsg((m) => { const n = { ...m }; delete n[sequenceId]; return n; });
    try {
      const res = await fetch("/api/marketing/sequences/enroll-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence_id: sequenceId, list_id: listId }),
      });
      const data = await res.json();
      setEnrollMsg((m) => ({ ...m, [sequenceId]: res.ok ? `Enrolled ${data.enrolled ?? 0} contacts` : data.error ?? "Failed to enroll" }));
      router.refresh();
    } catch {
      setEnrollMsg((m) => ({ ...m, [sequenceId]: "Failed to enroll list" }));
    }
  }
  const [stepForm, setStepForm] = useState({
    template_id: templates[0]?.id ?? "",
    delay_days: "0",
    condition: "always",
    from_name: "iCapOS",
    from_email: "outreach@icapos.com",
  });

  async function handleCreateSequence() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/marketing/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      setShowCreate(false);
      setNewName("");
      router.refresh();
    } catch (err) {
      console.error("Failed to create sequence:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddStep(sequenceId: string, stepOrder: number) {
    try {
      await fetch("/api/marketing/sequences/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence_id: sequenceId, step_order: stepOrder, ...stepForm, delay_days: Number(stepForm.delay_days) }),
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to add sequence step:", err);
    } finally {
      setAddingStep(null);
    }
  }

  async function handleStatusChange(sequenceId: string, status: string) {
    try {
      await fetch("/api/marketing/sequences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence_id: sequenceId, status }),
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to update sequence status:", err);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>Sequences</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{sequences.length} total</div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
          + New sequence
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>New sequence</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. LP warm-up drip"
              onKeyDown={(e) => e.key === "Enter" && handleCreateSequence()}
              style={{ flex: 1, fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }} />
            <button onClick={handleCreateSequence} disabled={saving}
              style={{ fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
              {saving ? "Creating…" : "Create"}
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ fontSize: 12, padding: "7px 12px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {sequences.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted-foreground)", fontSize: 13 }}>
          No sequences yet. Create one above.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {sequences.map((seq) => {
            const steps = seq.steps ?? [];
            const sc = statusColors[seq.status] ?? statusColors.draft;
            return (
              <div key={seq.id} style={{ ...card, padding: "16px 18px" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 500, fontSize: 14, color: "var(--foreground)" }}>{seq.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ApproverPicker sequenceId={seq.id} initialApproverId={(seq as { approver_id?: string | null }).approver_id ?? null} />
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>
                      {seq.status.charAt(0).toUpperCase() + seq.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Steps */}
                {steps.sort((a, b) => a.step_order - b.step_order).map((step, i) => (
                  <div key={step.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#EEEDFE", color: "#1A6CE4", fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {step.step_order}
                      </div>
                      {i < steps.length - 1 && <div style={{ width: 1, height: 12, background: "var(--border)", margin: "3px 0" }} />}
                    </div>
                    <div style={{ flex: 1, background: "var(--muted)", borderRadius: 8, padding: "8px 12px" }}>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 2 }}>
                        Day {step.delay_days} · {conditionLabels[step.condition]}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--foreground)" }}>
                        {(step.template as { name?: string } | null)?.name ?? "No template"}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add step */}
                {addingStep === seq.id ? (
                  <div style={{ background: "var(--muted)", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10, color: "var(--foreground)" }}>Add step</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>Template</label>
                        <select value={stepForm.template_id} onChange={(e) => setStepForm({ ...stepForm, template_id: e.target.value })}
                          style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}>
                          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>Condition</label>
                        <select value={stepForm.condition} onChange={(e) => setStepForm({ ...stepForm, condition: e.target.value })}
                          style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}>
                          {selectableConditions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>Delay (days)</label>
                        <input type="number" min="0" value={stepForm.delay_days} onChange={(e) => setStepForm({ ...stepForm, delay_days: e.target.value })}
                          style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleAddStep(seq.id, steps.length + 1)}
                        style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
                        Add step
                      </button>
                      <button onClick={() => setAddingStep(null)}
                        style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingStep(seq.id)}
                    style={{ width: "100%", marginTop: 8, fontSize: 12, padding: "7px", borderRadius: 6, border: "0.5px dashed var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}>
                    + Add step
                  </button>
                )}

                {/* Status actions */}
                <div style={{ display: "flex", gap: 6, marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--border)" }}>
                  {seq.status === "draft" && (
                    <button onClick={() => handleStatusChange(seq.id, "active")}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
                      Activate
                    </button>
                  )}
                  {seq.status === "active" && (
                    <button onClick={() => handleStatusChange(seq.id, "paused")}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
                      Pause
                    </button>
                  )}
                  {seq.status === "paused" && (
                    <button onClick={() => handleStatusChange(seq.id, "active")}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
                      Resume
                    </button>
                  )}
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", display: "flex", alignItems: "center", marginLeft: "auto" }}>
                    {steps.length} step{steps.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Enroll a list */}
                {steps.length > 0 ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
                    <select
                      value={listForSeq(seq.id)}
                      onChange={(e) => setEnrollListId((m) => ({ ...m, [seq.id]: e.target.value }))}
                      style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", color: "var(--foreground)" }}
                    >
                      {lists.length === 0 ? (
                        <option value="">No lists yet</option>
                      ) : (
                        lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)
                      )}
                    </select>
                    <button
                      onClick={() => handleEnrollList(seq.id)}
                      disabled={!listForSeq(seq.id)}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)", opacity: listForSeq(seq.id) ? 1 : 0.5 }}
                    >
                      Enroll list
                    </button>
                    {enrollMsg[seq.id] ? <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{enrollMsg[seq.id]}</span> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
