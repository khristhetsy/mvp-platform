"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  MarketingPlan,
  MarketingPlanItem,
  MarketingPlanItemChannel,
  MarketingPlanItemPriority,
  CmoPlanDraft,
} from "@/lib/marketing/types";

interface Props {
  plans: MarketingPlan[];
  aiEnabled: boolean;
}

const ACCENT = "#534AB7";

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "#F1EFE8", color: "#5F5E5A", label: "Draft" },
  active: { bg: "#E1F5EE", color: "#0F6E56", label: "Active" },
  archived: { bg: "#FCEBEB", color: "#A32D2D", label: "Archived" },
};

const ITEM_STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  planned: { bg: "#F1EFE8", color: "#5F5E5A", label: "Planned" },
  in_progress: { bg: "#E6F1FB", color: "#185FA5", label: "In progress" },
  done: { bg: "#E1F5EE", color: "#0F6E56", label: "Done" },
};

const PRIORITY_MAP: Record<string, { bg: string; color: string }> = {
  high: { bg: "#FCEBEB", color: "#A32D2D" },
  medium: { bg: "#FAEEDA", color: "#854F0B" },
  low: { bg: "#F1EFE8", color: "#5F5E5A" },
};

const CHANNELS: MarketingPlanItemChannel[] = [
  "email",
  "content",
  "social",
  "paid",
  "events",
  "pr",
  "seo",
  "partnerships",
  "other",
];

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "0.5px solid #e2e6ed",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
};

const btnPrimary: React.CSSProperties = {
  background: ACCENT,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  background: "#fff",
  color: "var(--foreground)",
  border: "0.5px solid #e2e6ed",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  border: "0.5px solid #e2e6ed",
  borderRadius: 8,
  background: "#fff",
  boxSizing: "border-box",
};

function Badge({ map, value }: { map: Record<string, { bg: string; color: string; label?: string }>; value: string }) {
  const s = map[value] ?? { bg: "#F1EFE8", color: "#5F5E5A" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 6,
        textTransform: "capitalize",
      }}
    >
      {s.label ?? value.replace(/_/g, " ")}
    </span>
  );
}

export function PlanClient({ plans, aiEnabled }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarketingPlan | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // create-plan form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    objective: "",
    target_audience: "",
    budget: "",
    start_date: "",
    end_date: "",
  });

  // AI CMO modal
  const [showCmo, setShowCmo] = useState(false);
  const [cmoBrief, setCmoBrief] = useState({ goal: "", timeframe: "", budget: "" });
  const [cmoLoading, setCmoLoading] = useState(false);
  const [draft, setDraft] = useState<CmoPlanDraft | null>(null);

  // add-initiative form
  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    channel: "other" as MarketingPlanItemChannel,
    priority: "medium" as MarketingPlanItemPriority,
  });

  async function openPlan(id: string) {
    setSelectedId(id);
    setLoadingDetail(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/marketing/plans/${id}`);
      if (res.ok) setDetail(await res.json());
    } finally {
      setLoadingDetail(false);
    }
  }

  async function refreshDetail() {
    if (selectedId) await openPlan(selectedId);
    router.refresh();
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setBusy("create");
    try {
      const res = await fetch("/api/marketing/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        }),
      });
      if (res.ok) {
        const plan = await res.json();
        setShowCreate(false);
        setForm({ name: "", objective: "", target_audience: "", budget: "", start_date: "", end_date: "" });
        router.refresh();
        openPlan(plan.id);
      }
    } finally {
      setBusy(null);
    }
  }

  async function runCmo() {
    if (!cmoBrief.goal.trim()) return;
    setCmoLoading(true);
    setDraft(null);
    try {
      const res = await fetch("/api/marketing/plans/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cmoBrief),
      });
      if (res.ok) setDraft(await res.json());
    } finally {
      setCmoLoading(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy("save-draft");
    try {
      const res = await fetch("/api/marketing/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          objective: draft.objective,
          summary: draft.summary,
          target_audience: draft.target_audience,
          budget: draft.budget,
          generated_by: "claude",
          items: draft.items,
        }),
      });
      if (res.ok) {
        const plan = await res.json();
        setShowCmo(false);
        setDraft(null);
        setCmoBrief({ goal: "", timeframe: "", budget: "" });
        router.refresh();
        openPlan(plan.id);
      }
    } finally {
      setBusy(null);
    }
  }

  async function addItem() {
    if (!selectedId || !newItem.title.trim()) return;
    setBusy("add-item");
    try {
      const res = await fetch(`/api/marketing/plans/${selectedId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      if (res.ok) {
        setNewItem({ title: "", description: "", channel: "other", priority: "medium" });
        refreshDetail();
      }
    } finally {
      setBusy(null);
    }
  }

  async function setItemStatus(item: MarketingPlanItem, status: MarketingPlanItem["status"]) {
    setBusy("item-" + item.id);
    try {
      await fetch(`/api/marketing/plans/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      refreshDetail();
    } finally {
      setBusy(null);
    }
  }

  async function syncTask(item: MarketingPlanItem) {
    setBusy("sync-" + item.id);
    try {
      await fetch(`/api/marketing/plans/items/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_task" }),
      });
      refreshDetail();
    } finally {
      setBusy(null);
    }
  }

  async function deleteItem(item: MarketingPlanItem) {
    setBusy("del-" + item.id);
    try {
      await fetch(`/api/marketing/plans/items/${item.id}`, { method: "DELETE" });
      refreshDetail();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
      {/* LEFT: plan list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...btnPrimary, flex: 1 }} onClick={() => setShowCreate((v) => !v)}>
            + New plan
          </button>
          <button
            style={{ ...btnGhost, flex: 1 }}
            onClick={() => setShowCmo(true)}
            title={aiEnabled ? "Generate a draft with the AI CMO" : "AI not configured — shows a starter outline"}
          >
            ✦ AI CMO
          </button>
        </div>

        {showCreate && (
          <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <input style={inputStyle} placeholder="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} placeholder="Objective / north-star goal" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
            <input style={inputStyle} placeholder="Target audience" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} />
            <input style={inputStyle} placeholder="Budget (e.g. $25k/mo)" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" style={inputStyle} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              <input type="date" style={inputStyle} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <button style={btnPrimary} disabled={busy === "create"} onClick={handleCreate}>
              {busy === "create" ? "Creating…" : "Create plan"}
            </button>
          </div>
        )}

        {plans.length === 0 && !showCreate && (
          <div style={{ ...card, padding: 16, fontSize: 12, color: "var(--muted-foreground)" }}>
            No plans yet. Create one manually or generate a draft with the AI CMO.
          </div>
        )}

        {plans.map((p) => (
          <button
            key={p.id}
            onClick={() => openPlan(p.id)}
            style={{
              ...card,
              padding: 14,
              textAlign: "left",
              cursor: "pointer",
              borderColor: selectedId === p.id ? ACCENT : "#e2e6ed",
              borderWidth: selectedId === p.id ? 1 : 0.5,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
              <Badge map={STATUS_MAP} value={p.status} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 11, color: "var(--muted-foreground)" }}>
              <span>{p.item_count ?? 0} initiatives</span>
              {p.generated_by === "claude" && <span style={{ color: ACCENT }}>✦ AI</span>}
            </div>
          </button>
        ))}
      </div>

      {/* RIGHT: detail */}
      <div>
        {!selectedId && (
          <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            Select a plan to view and manage its initiatives.
          </div>
        )}
        {loadingDetail && <div style={{ ...card, padding: 24, fontSize: 13 }}>Loading…</div>}
        {detail && !loadingDetail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...card, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>{detail.name}</h2>
                <Badge map={STATUS_MAP} value={detail.status} />
              </div>
              {detail.objective && <p style={{ fontSize: 13, marginTop: 10 }}><strong>Objective:</strong> {detail.objective}</p>}
              {detail.summary && <p style={{ fontSize: 13, marginTop: 8, color: "var(--muted-foreground)" }}>{detail.summary}</p>}
              <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--muted-foreground)", flexWrap: "wrap" }}>
                {detail.target_audience && <span><strong>Audience:</strong> {detail.target_audience}</span>}
                {detail.budget && <span><strong>Budget:</strong> {detail.budget}</span>}
                {(detail.start_date || detail.end_date) && (
                  <span><strong>Window:</strong> {detail.start_date ?? "—"} → {detail.end_date ?? "—"}</span>
                )}
              </div>
            </div>

            {/* Initiatives */}
            <div style={{ ...card, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Initiatives</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(detail.items ?? []).length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No initiatives yet.</div>
                )}
                {(detail.items ?? []).map((item) => (
                  <div key={item.id} style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
                        {item.description && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{item.description}</div>}
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <Badge map={{}} value={item.channel} />
                          <Badge map={PRIORITY_MAP} value={item.priority} />
                          <Badge map={ITEM_STATUS_MAP} value={item.status} />
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                        {item.task_id ? (
                          <span style={{ fontSize: 11, color: "#0F6E56", fontWeight: 500 }}>✓ Synced to Tasks</span>
                        ) : (
                          <button style={{ ...btnGhost, padding: "5px 10px" }} disabled={busy === "sync-" + item.id} onClick={() => syncTask(item)}>
                            {busy === "sync-" + item.id ? "Syncing…" : "→ Add to Tasks"}
                          </button>
                        )}
                        <select
                          style={{ ...inputStyle, padding: "4px 8px", width: "auto", fontSize: 11 }}
                          value={item.status}
                          onChange={(e) => setItemStatus(item, e.target.value as MarketingPlanItem["status"])}
                        >
                          <option value="planned">Planned</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Done</option>
                        </select>
                        <button style={{ ...btnGhost, padding: "4px 8px", color: "#A32D2D" }} disabled={busy === "del-" + item.id} onClick={() => deleteItem(item)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* add initiative */}
              <div style={{ marginTop: 16, borderTop: "0.5px solid #e2e6ed", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <input style={inputStyle} placeholder="New initiative title" value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} />
                <textarea style={{ ...inputStyle, minHeight: 44, resize: "vertical" }} placeholder="Description (optional)" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <select style={inputStyle} value={newItem.channel} onChange={(e) => setNewItem({ ...newItem, channel: e.target.value as MarketingPlanItemChannel })}>
                    {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select style={inputStyle} value={newItem.priority} onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as MarketingPlanItemPriority })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <button style={{ ...btnPrimary, whiteSpace: "nowrap" }} disabled={busy === "add-item"} onClick={addItem}>
                    {busy === "add-item" ? "Adding…" : "+ Add"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI CMO modal */}
      {showCmo && (
        <div
          onClick={() => !cmoLoading && setShowCmo(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(12,35,64,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 24, width: 640, maxHeight: "85vh", overflow: "auto" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>✦ AI CMO</h2>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
              {aiEnabled
                ? "Describe the goal — the CMO drafts a plan grounded in your contact & campaign data. Review, then save."
                : "AI is not configured (ANTHROPIC_API_KEY missing). You'll get an editable starter outline."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} placeholder="Goal — e.g. 'Grow founder signups 30% in Q3 via content + email'" value={cmoBrief.goal} onChange={(e) => setCmoBrief({ ...cmoBrief, goal: e.target.value })} />
              <div style={{ display: "flex", gap: 8 }}>
                <input style={inputStyle} placeholder="Timeframe (e.g. Q3 2026)" value={cmoBrief.timeframe} onChange={(e) => setCmoBrief({ ...cmoBrief, timeframe: e.target.value })} />
                <input style={inputStyle} placeholder="Budget (optional)" value={cmoBrief.budget} onChange={(e) => setCmoBrief({ ...cmoBrief, budget: e.target.value })} />
              </div>
              <button style={btnPrimary} disabled={cmoLoading || !cmoBrief.goal.trim()} onClick={runCmo}>
                {cmoLoading ? "Drafting…" : draft ? "Regenerate" : "Generate draft"}
              </button>
            </div>

            {draft && (
              <div style={{ marginTop: 18, borderTop: "0.5px solid #e2e6ed", paddingTop: 16 }}>
                {draft.isDemo && (
                  <div style={{ background: "#FAEEDA", color: "#854F0B", fontSize: 11, padding: "6px 10px", borderRadius: 6, marginBottom: 10 }}>
                    Starter outline (AI not configured) — fully editable after saving.
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 600 }}>{draft.name}</div>
                <p style={{ fontSize: 12, marginTop: 6 }}><strong>Objective:</strong> {draft.objective}</p>
                {draft.summary && <p style={{ fontSize: 12, marginTop: 6, color: "var(--muted-foreground)" }}>{draft.summary}</p>}
                {draft.target_audience && <p style={{ fontSize: 12, marginTop: 6 }}><strong>Audience:</strong> {draft.target_audience}</p>}
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {draft.items.map((it, i) => (
                    <div key={i} style={{ border: "0.5px solid #e2e6ed", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{it.title}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Badge map={{}} value={it.channel} />
                          <Badge map={PRIORITY_MAP} value={it.priority} />
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{it.description}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button style={btnPrimary} disabled={busy === "save-draft"} onClick={saveDraft}>
                    {busy === "save-draft" ? "Saving…" : "Save as plan"}
                  </button>
                  <button style={btnGhost} onClick={() => setShowCmo(false)}>Cancel</button>
                </div>
              </div>
            )}

            {!draft && (
              <div style={{ marginTop: 14, textAlign: "right" }}>
                <button style={btnGhost} onClick={() => setShowCmo(false)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
