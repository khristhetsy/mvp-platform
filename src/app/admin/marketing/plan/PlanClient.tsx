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

type ViewMode = "card" | "list" | "tree";

const ACCENT = "#534AB7";

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  draft:    { bg: "#F1EFE8", color: "#5F5E5A", label: "Draft" },
  active:   { bg: "#E1F5EE", color: "#0F6E56", label: "Active" },
  archived: { bg: "#FCEBEB", color: "#A32D2D", label: "Archived" },
};

const ITEM_STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  planned:     { bg: "#F1EFE8", color: "#5F5E5A",  label: "Planned" },
  in_progress: { bg: "#E6F1FB", color: "#185FA5",  label: "In progress" },
  done:        { bg: "#E1F5EE", color: "#0F6E56",  label: "Done" },
};

const PRIORITY_MAP: Record<string, { bg: string; color: string }> = {
  high:   { bg: "#FCEBEB", color: "#A32D2D" },
  medium: { bg: "#FAEEDA", color: "#854F0B" },
  low:    { bg: "#F1EFE8", color: "#5F5E5A" },
};

const CHANNEL_COLOR_MAP: Record<string, { bg: string; color: string }> = {
  email:        { bg: "#E6F1FB", color: "#185FA5" },
  content:      { bg: "#EEEDFE", color: "#3C3489" },
  social:       { bg: "#FBEAF0", color: "#993556" },
  paid:         { bg: "#FAECE7", color: "#993C1D" },
  events:       { bg: "#E1F5EE", color: "#0F6E56" },
  pr:           { bg: "#EAF3DE", color: "#3B6D11" },
  seo:          { bg: "#FAEEDA", color: "#854F0B" },
  partnerships: { bg: "#EEEDFE", color: "#3C3489" },
  other:        { bg: "#F1EFE8", color: "#5F5E5A" },
};

const CHANNELS: MarketingPlanItemChannel[] = [
  "email", "content", "social", "paid", "events", "pr", "seo", "partnerships", "other",
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

const smallInput: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontSize: 12,
  border: "0.5px solid #e2e6ed",
  borderRadius: 7,
  background: "#fff",
  boxSizing: "border-box",
};

function Badge({ map, value }: { map: Record<string, { bg: string; color: string; label?: string }>; value: string }) {
  const s = map[value] ?? { bg: "#F1EFE8", color: "#5F5E5A" };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, textTransform: "capitalize" }}>
      {s.label ?? value.replace(/_/g, " ")}
    </span>
  );
}

export function PlanClient({ plans, aiEnabled }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [detail, setDetail]             = useState<MarketingPlan | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy]                 = useState<string | null>(null);
  const [viewMode, setViewMode]         = useState<ViewMode>("card");

  // create-plan form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", objective: "", target_audience: "", budget: "", start_date: "", end_date: "" });

  // inline plan-card edit
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planEditForm, setPlanEditForm]   = useState({ name: "", objective: "", status: "draft", budget: "", target_audience: "" });

  // AI CMO
  const [showCmo, setShowCmo]       = useState(false);
  const [cmoBrief, setCmoBrief]     = useState({ goal: "", timeframe: "", budget: "" });
  const [cmoLoading, setCmoLoading] = useState(false);
  const [draft, setDraft]           = useState<CmoPlanDraft | null>(null);

  // edit initiative modal
  const [editingItem, setEditingItem] = useState<MarketingPlanItem | null>(null);
  const [editForm, setEditForm]       = useState({ title: "", description: "" });

  // add-initiative form
  const [newItem, setNewItem] = useState({
    title: "", description: "",
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
        body: JSON.stringify({ ...form, start_date: form.start_date || null, end_date: form.end_date || null }),
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

  function startPlanEdit(p: MarketingPlan) {
    setEditingPlanId(p.id);
    setPlanEditForm({
      name: p.name,
      objective: p.objective ?? "",
      status: p.status,
      budget: p.budget ?? "",
      target_audience: p.target_audience ?? "",
    });
  }

  async function savePlanEdit() {
    if (!editingPlanId) return;
    setBusy("plan-edit-" + editingPlanId);
    try {
      const res = await fetch(`/api/marketing/plans/${editingPlanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planEditForm.name,
          objective: planEditForm.objective || null,
          status: planEditForm.status,
          budget: planEditForm.budget || null,
          target_audience: planEditForm.target_audience || null,
        }),
      });
      if (res.ok) {
        setEditingPlanId(null);
        if (selectedId === editingPlanId) refreshDetail();
        else router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function deletePlan(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This also removes all its initiatives.`)) return;
    setBusy("plan-del-" + id);
    try {
      await fetch(`/api/marketing/plans/${id}`, { method: "DELETE" });
      if (selectedId === id) { setSelectedId(null); setDetail(null); }
      router.refresh();
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
          name: draft.name, objective: draft.objective, summary: draft.summary,
          target_audience: draft.target_audience, budget: draft.budget,
          generated_by: "claude", items: draft.items,
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
    if (!confirm(`Delete "${item.title}"?`)) return;
    setBusy("del-" + item.id);
    try {
      await fetch(`/api/marketing/plans/items/${item.id}`, { method: "DELETE" });
      refreshDetail();
    } finally {
      setBusy(null);
    }
  }

  function openEdit(item: MarketingPlanItem) {
    setEditingItem(item);
    setEditForm({ title: item.title, description: item.description ?? "" });
  }

  async function saveEdit() {
    if (!editingItem) return;
    setBusy("edit-" + editingItem.id);
    try {
      const res = await fetch(`/api/marketing/plans/items/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editForm.title, description: editForm.description }),
      });
      if (res.ok) { setEditingItem(null); refreshDetail(); }
    } finally {
      setBusy(null);
    }
  }

  // ── Card view ──────────────────────────────────────────────────────────────
  function renderCardView(items: MarketingPlanItem[]) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {items.map((item) => {
          const ch = CHANNEL_COLOR_MAP[item.channel] ?? CHANNEL_COLOR_MAP.other;
          const pr = PRIORITY_MAP[item.priority];
          return (
            <div key={item.id} style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ background: ch.bg, color: ch.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, textTransform: "capitalize" }}>{item.channel}</span>
                <div style={{ display: "flex", gap: 2 }}>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "2px 5px", fontSize: 15 }} onClick={() => openEdit(item)} title="Edit">✎</button>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: "#A32D2D", padding: "2px 5px", fontSize: 15 }} disabled={busy === "del-" + item.id} onClick={() => deleteItem(item)} title="Delete">✕</button>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
              {item.description && <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, flex: 1 }}>{item.description}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {item.due_date ? <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Due {item.due_date}</span> : <span />}
                <span style={{ background: pr.bg, color: pr.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, textTransform: "capitalize" }}>{item.priority}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "0.5px solid #e2e6ed", paddingTop: 8 }}>
                {item.task_id ? (
                  <span style={{ fontSize: 11, color: "#0F6E56", fontWeight: 500 }}>✓ Synced to Tasks</span>
                ) : (
                  <button style={{ ...btnGhost, padding: "4px 9px", fontSize: 11 }} disabled={busy === "sync-" + item.id} onClick={() => syncTask(item)}>
                    {busy === "sync-" + item.id ? "…" : "→ Add to Tasks"}
                  </button>
                )}
                <select style={{ ...inputStyle, padding: "3px 6px", width: "auto", fontSize: 11 }} value={item.status} onChange={(e) => setItemStatus(item, e.target.value as MarketingPlanItem["status"])}>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  function renderListView(items: MarketingPlanItem[]) {
    return (
      <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 72px 110px 56px", padding: "7px 14px", background: "#f8f9fb", borderBottom: "0.5px solid #e2e6ed" }}>
          {["Initiative", "Channel", "Priority", "Status", ""].map((h) => (
            <span key={h} style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>{h}</span>
          ))}
        </div>
        {items.map((item, i) => {
          const ch = CHANNEL_COLOR_MAP[item.channel] ?? CHANNEL_COLOR_MAP.other;
          return (
            <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 90px 72px 110px 56px", padding: "10px 14px", borderBottom: i < items.length - 1 ? "0.5px solid #e2e6ed" : "none", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
                {item.description && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{item.description}</div>}
              </div>
              <span style={{ background: ch.bg, color: ch.color, fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 6, textTransform: "capitalize", width: "fit-content" }}>{item.channel}</span>
              <span style={{ background: PRIORITY_MAP[item.priority]?.bg, color: PRIORITY_MAP[item.priority]?.color, fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 6, textTransform: "capitalize", width: "fit-content" }}>{item.priority}</span>
              <select style={{ ...inputStyle, padding: "3px 6px", width: "auto", fontSize: 11 }} value={item.status} onChange={(e) => setItemStatus(item, e.target.value as MarketingPlanItem["status"])}>
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
              <div style={{ display: "flex", gap: 2 }}>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "2px 5px", fontSize: 15 }} onClick={() => openEdit(item)} title="Edit">✎</button>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "#A32D2D", padding: "2px 5px", fontSize: 15 }} disabled={busy === "del-" + item.id} onClick={() => deleteItem(item)} title="Delete">✕</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Tree view ──────────────────────────────────────────────────────────────
  function renderTreeView(items: MarketingPlanItem[], plan: MarketingPlan) {
    const grouped = CHANNELS.reduce<Record<string, MarketingPlanItem[]>>((acc, ch) => {
      const filtered = items.filter((i) => i.channel === ch);
      if (filtered.length > 0) acc[ch] = filtered;
      return acc;
    }, {});
    const channelKeys = Object.keys(grouped);
    return (
      <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, padding: "16px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, flexShrink: 0 }}>✦</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{plan.name}</div>
            {plan.objective && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{plan.objective}</div>}
          </div>
        </div>
        <div style={{ marginLeft: 17, borderLeft: "1.5px solid #e2e6ed" }}>
          {channelKeys.length === 0 && <div style={{ marginLeft: 20, fontSize: 12, color: "var(--muted-foreground)" }}>No initiatives yet.</div>}
          {channelKeys.map((channel, gi) => {
            const ch = CHANNEL_COLOR_MAP[channel] ?? CHANNEL_COLOR_MAP.other;
            const channelItems = grouped[channel];
            return (
              <div key={channel} style={{ position: "relative", marginBottom: gi < channelKeys.length - 1 ? 10 : 0 }}>
                <div style={{ position: "absolute", left: -1, top: 17, width: 20, height: 1.5, background: "#e2e6ed" }} />
                <div style={{ marginLeft: 20, display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 7, background: ch.bg, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: ch.color, textTransform: "capitalize" }}>{channel}</span>
                  <span style={{ fontSize: 11, color: ch.color, marginLeft: "auto", opacity: 0.8 }}>{channelItems.length} {channelItems.length === 1 ? "initiative" : "initiatives"}</span>
                </div>
                <div style={{ marginLeft: 36, borderLeft: "1.5px solid #e2e6ed" }}>
                  {channelItems.map((item, ii) => {
                    const pr = PRIORITY_MAP[item.priority];
                    return (
                      <div key={item.id} style={{ position: "relative", marginBottom: ii < channelItems.length - 1 ? 6 : 8 }}>
                        <div style={{ position: "absolute", left: -1, top: "50%", width: 18, height: 1.5, background: "#e2e6ed" }} />
                        <div style={{ marginLeft: 18, border: "0.5px solid #e2e6ed", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 120 }}>{item.title}</span>
                          {item.due_date && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Due {item.due_date}</span>}
                          <span style={{ background: pr.bg, color: pr.color, fontSize: 11, fontWeight: 500, padding: "1px 7px", borderRadius: 6, textTransform: "capitalize" }}>{item.priority}</span>
                          <Badge map={ITEM_STATUS_MAP} value={item.status} />
                          <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "2px 4px", fontSize: 14 }} onClick={() => openEdit(item)} title="Edit">✎</button>
                          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#A32D2D", padding: "2px 4px", fontSize: 14 }} disabled={busy === "del-" + item.id} onClick={() => deleteItem(item)} title="Delete">✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const items = detail?.items ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── TOP ROW: plan list left, hint right ──────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>

        {/* Plan list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...btnPrimary, flex: 1 }} onClick={() => { setShowCreate((v) => !v); setShowCmo(false); }}>
              + New plan
            </button>
            <button
              style={{ ...btnGhost, flex: 1 }}
              onClick={() => { setShowCmo(true); setShowCreate(false); }}
              title={aiEnabled ? "Generate a draft with the AI CMO" : "AI not configured — shows a starter outline"}
            >
              ✦ AI CMO
            </button>
          </div>

          {plans.length === 0 && !showCreate && (
            <div style={{ ...card, padding: 16, fontSize: 12, color: "var(--muted-foreground)" }}>
              No plans yet. Create one manually or generate a draft with the AI CMO.
            </div>
          )}

          {plans.map((p) => (
            <div
              key={p.id}
              style={{
                ...card,
                padding: 14,
                borderColor: selectedId === p.id ? ACCENT : "#e2e6ed",
                borderWidth: selectedId === p.id ? 1 : 0.5,
              }}
            >
              {editingPlanId === p.id ? (
                /* ── Inline edit form ── */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted-foreground)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".06em" }}>Plan name</label>
                    <input style={smallInput} value={planEditForm.name} onChange={(e) => setPlanEditForm({ ...planEditForm, name: e.target.value })} autoFocus />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted-foreground)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".06em" }}>Objective</label>
                    <textarea rows={2} style={{ ...smallInput, resize: "vertical" }} value={planEditForm.objective} onChange={(e) => setPlanEditForm({ ...planEditForm, objective: e.target.value })} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "var(--muted-foreground)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".06em" }}>Status</label>
                      <select style={smallInput} value={planEditForm.status} onChange={(e) => setPlanEditForm({ ...planEditForm, status: e.target.value })}>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "var(--muted-foreground)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".06em" }}>Budget</label>
                      <input style={smallInput} placeholder="e.g. $25k/mo" value={planEditForm.budget} onChange={(e) => setPlanEditForm({ ...planEditForm, budget: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted-foreground)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".06em" }}>Target audience</label>
                    <input style={smallInput} placeholder="e.g. SaaS founders, Series A" value={planEditForm.target_audience} onChange={(e) => setPlanEditForm({ ...planEditForm, target_audience: e.target.value })} />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                    <button style={{ ...btnGhost, flex: 1, padding: "6px 8px", fontSize: 11 }} onClick={() => setEditingPlanId(null)}>Cancel</button>
                    <button style={{ ...btnPrimary, flex: 1, padding: "6px 8px", fontSize: 11 }} disabled={busy === "plan-edit-" + p.id || !planEditForm.name.trim()} onClick={savePlanEdit}>
                      {busy === "plan-edit-" + p.id ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div>
                  <button
                    onClick={() => openPlan(p.id)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                      <Badge map={STATUS_MAP} value={p.status} />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 7, fontSize: 11, color: "var(--muted-foreground)" }}>
                      <span>{p.item_count ?? 0} initiatives</span>
                      {p.generated_by === "claude" && <span style={{ color: ACCENT }}>✦ AI</span>}
                    </div>
                  </button>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button style={{ ...btnGhost, flex: 1, padding: "5px 8px", fontSize: 11 }} onClick={() => startPlanEdit(p)}>✎ Edit</button>
                    <button style={{ ...btnGhost, flex: 1, padding: "5px 8px", fontSize: 11, color: "#A32D2D", borderColor: "#F0A0A0" }} disabled={busy === "plan-del-" + p.id} onClick={() => deletePlan(p.id, p.name)}>
                      {busy === "plan-del-" + p.id ? "Deleting…" : "✕ Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Create form — below plan cards */}
          {showCreate && (
            <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 8, borderStyle: "dashed" }}>
              <p style={{ fontSize: 12, fontWeight: 500, margin: 0 }}>New plan</p>
              <input style={smallInput} placeholder="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              <textarea rows={2} style={{ ...smallInput, resize: "vertical" }} placeholder="Objective / north-star goal" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <input style={smallInput} placeholder="Target audience" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} />
                <input style={smallInput} placeholder="Budget" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...btnGhost, flex: 1, padding: "6px 8px", fontSize: 11 }} onClick={() => setShowCreate(false)}>Cancel</button>
                <button style={{ ...btnPrimary, flex: 1, padding: "6px 8px", fontSize: 11 }} disabled={busy === "create" || !form.name.trim()} onClick={handleCreate}>
                  {busy === "create" ? "Creating…" : "Create plan"}
                </button>
              </div>
            </div>
          )}

          {/* AI CMO draft — below plan cards */}
          {showCmo && (
            <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 8, borderColor: ACCENT }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 12, fontWeight: 500, margin: 0, color: ACCENT }}>✦ AI CMO</p>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 16 }} onClick={() => { setShowCmo(false); setDraft(null); }}>✕</button>
              </div>
              {!draft ? (
                <>
                  <textarea rows={2} style={{ ...smallInput, resize: "vertical" }} placeholder="Goal — e.g. 'Grow signups 30% via content + email'" value={cmoBrief.goal} onChange={(e) => setCmoBrief({ ...cmoBrief, goal: e.target.value })} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <input style={smallInput} placeholder="Timeframe (e.g. Q3 2026)" value={cmoBrief.timeframe} onChange={(e) => setCmoBrief({ ...cmoBrief, timeframe: e.target.value })} />
                    <input style={smallInput} placeholder="Budget (optional)" value={cmoBrief.budget} onChange={(e) => setCmoBrief({ ...cmoBrief, budget: e.target.value })} />
                  </div>
                  <button style={{ ...btnPrimary, padding: "6px 8px", fontSize: 11 }} disabled={cmoLoading || !cmoBrief.goal.trim()} onClick={runCmo}>
                    {cmoLoading ? "Drafting… 20–30s" : "Generate draft"}
                  </button>
                </>
              ) : (
                <>
                  {draft.isDemo && (
                    <div style={{ background: "#FAEEDA", color: "#854F0B", fontSize: 11, padding: "5px 8px", borderRadius: 6 }}>
                      Starter outline (AI not configured) — editable after saving.
                    </div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{draft.name}</div>
                  <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>{draft.objective}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {draft.items.slice(0, 4).map((it, i) => {
                      const ch = CHANNEL_COLOR_MAP[it.channel] ?? CHANNEL_COLOR_MAP.other;
                      return (
                        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "var(--muted-foreground)" }}>
                          <span style={{ background: ch.bg, color: ch.color, padding: "1px 6px", borderRadius: 20, fontWeight: 500, fontSize: 10, textTransform: "capitalize", flexShrink: 0 }}>{it.channel}</span>
                          {it.title}
                        </div>
                      );
                    })}
                    {draft.items.length > 4 && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>+{draft.items.length - 4} more</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ ...btnGhost, flex: 1, padding: "6px 8px", fontSize: 11 }} onClick={() => setDraft(null)}>Regenerate</button>
                    <button style={{ ...btnPrimary, flex: 1, padding: "6px 8px", fontSize: 11 }} disabled={busy === "save-draft"} onClick={saveDraft}>
                      {busy === "save-draft" ? "Saving…" : "Save as plan"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: hint when nothing selected */}
        {!selectedId && (
          <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            Select a plan to view and manage its initiatives.
          </div>
        )}
        {loadingDetail && (
          <div style={{ ...card, padding: 24, fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</div>
        )}
      </div>

      {/* ── BELOW: plan detail + initiatives, full width ─────────────────── */}
      {detail && !loadingDetail && (
        <>
          {/* Plan detail card */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{detail.name}</h2>
              <Badge map={STATUS_MAP} value={detail.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, auto)", gap: 24, alignItems: "start" }}>
              {detail.objective && (
                <div>
                  <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: ".06em" }}>Objective</p>
                  <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>{detail.objective}</p>
                </div>
              )}
              {detail.target_audience && (
                <div style={{ minWidth: 140 }}>
                  <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: ".06em" }}>Audience</p>
                  <p style={{ fontSize: 13, margin: 0 }}>{detail.target_audience}</p>
                </div>
              )}
              {detail.budget && (
                <div style={{ minWidth: 100 }}>
                  <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: ".06em" }}>Budget</p>
                  <p style={{ fontSize: 13, margin: 0 }}>{detail.budget}</p>
                </div>
              )}
              {(detail.start_date ?? detail.end_date) && (
                <div style={{ minWidth: 160 }}>
                  <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: ".06em" }}>Window</p>
                  <p style={{ fontSize: 13, margin: 0 }}>{detail.start_date ?? "—"} → {detail.end_date ?? "—"}</p>
                </div>
              )}
            </div>
            {detail.summary && <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "12px 0 0", lineHeight: 1.6 }}>{detail.summary}</p>}
          </div>

          {/* Initiatives card */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Initiatives</h3>
              <div style={{ display: "flex", gap: 4 }}>
                {(["card", "list", "tree"] as ViewMode[]).map((mode) => {
                  const labels: Record<ViewMode, string> = { card: "⊞ Cards", list: "≡ List", tree: "⌥ Tree" };
                  const active = viewMode === mode;
                  return (
                    <button key={mode} onClick={() => setViewMode(mode)} style={{ ...btnGhost, padding: "5px 10px", fontSize: 11, background: active ? ACCENT : "#fff", color: active ? "#fff" : "var(--foreground)", borderColor: active ? ACCENT : "#e2e6ed" }}>
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>
            </div>

            {items.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>No initiatives yet — add one below.</div>
            ) : viewMode === "card" ? renderCardView(items)
              : viewMode === "list" ? renderListView(items)
              : renderTreeView(items, detail)}

            {/* Add initiative */}
            <div style={{ marginTop: 16, borderTop: "0.5px solid #e2e6ed", paddingTop: 14, display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="New initiative title" value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} />
              <select style={{ ...inputStyle, width: "auto" }} value={newItem.channel} onChange={(e) => setNewItem({ ...newItem, channel: e.target.value as MarketingPlanItemChannel })}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select style={{ ...inputStyle, width: "auto" }} value={newItem.priority} onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as MarketingPlanItemPriority })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button style={{ ...btnPrimary, whiteSpace: "nowrap" }} disabled={busy === "add-item"} onClick={addItem}>
                {busy === "add-item" ? "Adding…" : "+ Add"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Edit initiative modal ─────────────────────────────────────────── */}
      {editingItem && (
        <div onClick={() => setEditingItem(null)} style={{ position: "fixed", inset: 0, background: "rgba(12,35,64,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 24, width: 520 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Edit initiative</h2>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14 }}>Changes are saved immediately to the plan.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Title</label>
                <input style={inputStyle} value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button style={btnGhost} onClick={() => setEditingItem(null)}>Cancel</button>
                <button style={btnPrimary} disabled={busy === "edit-" + editingItem.id || !editForm.title.trim()} onClick={saveEdit}>
                  {busy === "edit-" + editingItem.id ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
