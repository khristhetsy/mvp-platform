"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketingSequence, MarketingTemplate } from "@/lib/marketing/types";

interface Props {
  sequences: MarketingSequence[];
  templates: MarketingTemplate[];
}

const conditionLabels: Record<string, string> = {
  always: "Always send",
  no_open: "If not opened",
  no_click: "If not clicked",
  no_reply: "If no reply",
};

const statusColors: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#F1EFE8", color: "#5F5E5A" },
  active: { bg: "#EAF3DE", color: "#3B6D11" },
  paused: { bg: "#FAEEDA", color: "#854F0B" },
  archived: { bg: "#FCEBEB", color: "#A32D2D" },
};

export function SequencesClient({ sequences, templates }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingStep, setAddingStep] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState({
    template_id: templates[0]?.id ?? "",
    delay_days: "0",
    condition: "always",
    from_name: "CapitalOS",
    from_email: "outreach@mail.myicfos.com",
  });

  async function handleCreateSequence() {
    if (!newName.trim()) return;
    setSaving(true);
    await fetch("/api/marketing/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setSaving(false);
    setShowCreate(false);
    setNewName("");
    router.refresh();
  }

  async function handleAddStep(sequenceId: string, stepOrder: number) {
    await fetch("/api/marketing/sequences/steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence_id: sequenceId, step_order: stepOrder, ...stepForm, delay_days: Number(stepForm.delay_days) }),
    });
    setAddingStep(null);
    router.refresh();
  }

  async function handleStatusChange(sequenceId: string, status: string) {
    await fetch("/api/marketing/sequences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence_id: sequenceId, status }),
    });
    router.refresh();
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
        >
          + New sequence
        </button>
      </div>

      {showCreate && (
        <div style={{ background: "var(--muted)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Sequence name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Demo follow-up"
              onKeyDown={(e) => e.key === "Enter" && handleCreateSequence()}
              style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
            />
          </div>
          <button
            onClick={handleCreateSequence}
            disabled={saving}
            style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
          >
            {saving ? "Creating…" : "Create"}
          </button>
          <button
            onClick={() => setShowCreate(false)}
            style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      )}

      {sequences.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No sequences yet. Create one above.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {sequences.map((seq) => {
          const steps = seq.steps ?? [];
          const sc = statusColors[seq.status] ?? statusColors.draft;
          const isExpanded = expandedId === seq.id;
          return (
            <div
              key={seq.id}
              style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{seq.name}</div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>
                  {seq.status.charAt(0).toUpperCase() + seq.status.slice(1)}
                </span>
              </div>

              {/* Steps */}
              {steps.sort((a, b) => a.step_order - b.step_order).map((step, i) => (
                <div key={step.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%", background: "#EEEDFE", color: "#3C3489",
                      fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {step.step_order}
                    </div>
                    {i < steps.length - 1 && (
                      <div style={{ width: 1, height: 10, background: "var(--border)", margin: "2px 0" }} />
                    )}
                  </div>
                  <div style={{ flex: 1, background: "var(--muted)", borderRadius: 8, padding: "7px 10px" }}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      Day {step.delay_days} · {conditionLabels[step.condition]}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {(step.template as { name?: string } | null)?.name ?? "No template"}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add step */}
              {addingStep === seq.id ? (
                <div style={{ background: "var(--muted)", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Add step</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>Template</label>
                      <select
                        value={stepForm.template_id}
                        onChange={(e) => setStepForm({ ...stepForm, template_id: e.target.value })}
                        style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      >
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>Condition</label>
                      <select
                        value={stepForm.condition}
                        onChange={(e) => setStepForm({ ...stepForm, condition: e.target.value })}
                        style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      >
                        {Object.entries(conditionLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 3 }}>Delay (days after prev)</label>
                      <input
                        type="number"
                        min="0"
                        value={stepForm.delay_days}
                        onChange={(e) => setStepForm({ ...stepForm, delay_days: e.target.value })}
                        style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleAddStep(seq.id, steps.length + 1)}
                      style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
                    >
                      Add step
                    </button>
                    <button
                      onClick={() => setAddingStep(null)}
                      style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingStep(seq.id)}
                  style={{ width: "100%", marginTop: 8, fontSize: 12, padding: "6px", borderRadius: 6, border: "0.5px dashed var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}
                >
                  + Add step
                </button>
              )}

              {/* Status actions */}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {seq.status === "draft" && (
                  <button
                    onClick={() => handleStatusChange(seq.id, "active")}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
                  >
                    Activate
                  </button>
                )}
                {seq.status === "active" && (
                  <button
                    onClick={() => handleStatusChange(seq.id, "paused")}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
                  >
                    Pause
                  </button>
                )}
                {seq.status === "paused" && (
                  <button
                    onClick={() => handleStatusChange(seq.id, "active")}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
                  >
                    Resume
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
