"use client";

import { useState } from "react";

const NAVY = "#E8EDF7", BLUE = "#8FB4FF", MUTED = "#7C8DB5", CARD = "#0C142E", PANEL = "#0A1128", CHIP = "#132146";

interface SummarySection { title: string; summary: string }
interface Recommendation { title: string; detail: string; priority: "high" | "med" | "low" }

const PRIO: Record<string, { bg: string; c: string }> = {
  high: { bg: "#FCE9EC", c: "#D6455D" }, med: { bg: "#EEF3FC", c: "#185FA5" }, low: { bg: "#F1EFE8", c: "#5F5E5A" },
};

export function MeetingRecapPanel({ sessionId, isAdmin, onTaskCreated }: { sessionId: string; isAdmin: boolean; onTaskCreated: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
      <SummaryRecap sessionId={sessionId} isAdmin={isAdmin} />
      <Recommendations sessionId={sessionId} onTaskCreated={onTaskCreated} />
    </div>
  );
}

function SummaryRecap({ sessionId, isAdmin }: { sessionId: string; isAdmin: boolean }) {
  const [note, setNote] = useState("");
  const [decisions, setDecisions] = useState("");
  const [busy, setBusy] = useState<null | "gen" | "pub">(null);
  const [msg, setMsg] = useState<string | null>(null);

  const generate = async () => {
    setBusy("gen"); setMsg(null);
    try {
      const r = await fetch(`/api/admin/meetings/${sessionId}/summary`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(typeof d.error === "string" ? d.error : "Failed to summarize."); return; }
      const sections = (d.summary?.sections ?? []) as SummarySection[];
      setNote(sections.map((s) => `## ${s.title}\n${s.summary}`).join("\n\n"));
      setDecisions(((d.summary?.decisions ?? []) as string[]).join(", "));
    } catch { setMsg("Failed to summarize."); }
    finally { setBusy(null); }
  };
  const publish = async () => {
    setBusy("pub"); setMsg(null);
    try {
      const r = await fetch(`/api/admin/meetings/${sessionId}/summary`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, decisions: decisions.split(",").map((s) => s.trim()).filter(Boolean) }),
      });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? "Published to the meeting record." : (typeof d.error === "string" ? d.error : "Publish failed."));
    } catch { setMsg("Publish failed."); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ background: CARD, border: "0.5px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Meeting summary</span>
        <button onClick={() => void generate()} disabled={busy !== null} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>{busy === "gen" ? "Summarizing…" : "Generate summary"}</button>
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={7} placeholder="Generate a summary, then edit before publishing…" style={{ width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "0.5px solid rgba(255,255,255,.10)", resize: "vertical" }} />
      <input value={decisions} onChange={(e) => setDecisions(e.target.value)} placeholder="Decisions (comma-separated)" style={{ width: "100%", fontSize: 12, padding: "7px 9px", borderRadius: 8, border: "0.5px solid rgba(255,255,255,.10)", marginTop: 8 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        {isAdmin && <button onClick={() => void publish()} disabled={busy !== null || !note.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer" }}>{busy === "pub" ? "Publishing…" : "Publish to record"}</button>}
        {!isAdmin && <span style={{ fontSize: 11.5, color: MUTED }}>Only the CEO/Admin can publish.</span>}
        {msg && <span style={{ fontSize: 11.5, color: MUTED }}>{msg}</span>}
      </div>
    </div>
  );
}

function Recommendations({ sessionId, onTaskCreated }: { sessionId: string; onTaskCreated: () => void }) {
  const [cards, setCards] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Record<string, boolean>>({});

  const generate = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/meetings/${sessionId}/recommendations`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setCards((d.recommendations ?? []) as Recommendation[]);
    } finally { setBusy(false); }
  };
  const createTask = async (rec: Recommendation) => {
    setCreated((p) => ({ ...p, [rec.title]: true }));
    await fetch("/api/admin/meetings/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: rec.title, priority: rec.priority === "med" ? "med" : rec.priority, session_id: sessionId, source: "ai_confirmed" }),
    }).catch(() => {});
    onTaskCreated();
  };

  return (
    <div style={{ background: CARD, border: "0.5px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Cross-department recommendations</span>
        <button onClick={() => void generate()} disabled={busy} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: BLUE, background: CHIP, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>{busy ? "Analyzing…" : "Generate"}</button>
      </div>
      {cards.length === 0 ? <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Advisory cards from carryover age and KPI gaps across departments.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cards.map((rec, i) => {
            const tone = PRIO[rec.priority] ?? PRIO.med;
            return (
              <div key={i} style={{ border: "0.5px solid rgba(255,255,255,.10)", borderRadius: 9, padding: "9px 11px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", background: tone.bg, color: tone.c, borderRadius: 5, padding: "1px 6px" }}>{rec.priority}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: NAVY, flex: 1 }}>{rec.title}</span>
                  <button onClick={() => void createTask(rec)} disabled={created[rec.title]} style={{ fontSize: 11, fontWeight: 600, color: created[rec.title] ? MUTED : "#0F6E56", background: created[rec.title] ? "#F1EFE8" : "#E1F5EE", border: "none", borderRadius: 6, padding: "3px 9px", cursor: created[rec.title] ? "default" : "pointer" }}>{created[rec.title] ? "Created" : "Create task"}</button>
                </div>
                {rec.detail && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>{rec.detail}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
