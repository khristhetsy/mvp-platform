"use client";

import { useCallback, useEffect, useState } from "react";

const NAVY = "#E8EDF7", BLUE = "#8FB4FF", MUTED = "#7C8DB5", CARD = "#0C142E", PANEL = "#0A1128", CHIP = "#132146";

interface Brief { narrative: string; focus_points: string[]; risks: string[]; model: string | null; cached: boolean }
interface Suggestion { id: string; title: string; rationale: string | null; department_name: string | null; suggested_due: string | null }

export function MeetingAiPanel({ sessionId, onTaskCreated }: { sessionId: string; onTaskCreated: () => void }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [briefBusy, setBriefBusy] = useState(false);
  const [sugBusy, setSugBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadSuggestions = useCallback(() => {
    fetch(`/api/admin/meetings/${sessionId}/suggestions`).then((r) => r.json()).then((d) => setSuggestions((d.suggestions ?? []) as Suggestion[])).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    fetch(`/api/admin/meetings/${sessionId}/ai/brief`).then((r) => r.json()).then((d) => setBrief(d.brief ?? null)).catch(() => {});
    loadSuggestions();
  }, [sessionId, loadSuggestions]);

  const genBrief = async (force: boolean) => {
    setBriefBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/meetings/${sessionId}/ai/brief${force ? "?force=1" : ""}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setErr(typeof d.error === "string" ? d.error : "Failed to generate brief."); return; }
      setBrief(d.brief ?? null);
    } catch { setErr("Failed to generate brief."); }
    finally { setBriefBusy(false); }
  };

  const genSuggestions = async () => {
    setSugBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/meetings/${sessionId}/ai/suggest`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setErr(typeof d.error === "string" ? d.error : "Failed to generate suggestions."); return; }
      setSuggestions((d.suggestions ?? []) as Suggestion[]);
    } catch { setErr("Failed to generate suggestions."); }
    finally { setSugBusy(false); }
  };

  const resolve = async (id: string, action: "confirm" | "dismiss") => {
    setSuggestions((p) => p.filter((s) => s.id !== id)); // optimistic
    try {
      const r = await fetch(`/api/admin/meetings/suggestions/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!r.ok) { loadSuggestions(); return; }
      if (action === "confirm") onTaskCreated();
    } catch { loadSuggestions(); }
  };

  return (
    <div style={{ background: "#0E1A3E", border: "0.5px solid rgba(90,140,239,.35)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: BLUE }}>✦ AI Chief-of-Staff</span>
        {brief?.model === null && brief && <span style={{ fontSize: 10, color: MUTED }}>heuristic</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => void genBrief(!!brief)} disabled={briefBusy} style={btn("#2E6BFF", "#fff")}>{briefBusy ? "Thinking…" : brief ? "Refresh brief" : "Generate brief"}</button>
          <button onClick={() => void genSuggestions()} disabled={sugBusy} style={btn(CHIP, BLUE)}>{sugBusy ? "Analyzing…" : "Suggest actions"}</button>
        </div>
      </div>

      {err && <div style={{ fontSize: 11.5, color: "#A32D2D", marginBottom: 8 }}>{err}</div>}

      {brief ? (
        <div style={{ marginBottom: suggestions.length ? 14 : 0 }}>
          <p style={{ fontSize: 12.5, color: NAVY, margin: "0 0 8px", lineHeight: 1.5 }}>{brief.narrative}</p>
          {brief.focus_points.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", marginBottom: 3 }}>Focus</div>
              {brief.focus_points.map((p, i) => <div key={i} style={{ fontSize: 12, color: NAVY, padding: "1px 0" }}>• {p}</div>)}
            </div>
          )}
          {brief.risks.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#A32D2D", textTransform: "uppercase", marginBottom: 3 }}>Risks / gaps</div>
              {brief.risks.map((p, i) => <div key={i} style={{ fontSize: 12, color: "#7A2626", padding: "1px 0" }}>• {p}</div>)}
            </div>
          )}
        </div>
      ) : <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Generate a pre-read of the section journals, or suggest follow-up action items.</p>}

      {suggestions.length > 0 && (
        <div style={{ borderTop: "0.5px solid #E3ECF8", paddingTop: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>Suggested actions · {suggestions.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map((s) => (
              <div key={s.id} style={{ background: CARD, border: "0.5px solid rgba(255,255,255,.10)", borderRadius: 9, padding: "8px 11px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: NAVY }}>{s.title}</div>
                    {s.rationale && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{s.rationale}</div>}
                  </div>
                  <button onClick={() => void resolve(s.id, "confirm")} style={btn("#E1F5EE", "#0F6E56")}>Confirm → task</button>
                  <button onClick={() => void resolve(s.id, "dismiss")} style={{ ...btn("transparent", MUTED), border: "0.5px solid rgba(255,255,255,.10)" }}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function btn(bg: string, color: string): React.CSSProperties {
  return { fontSize: 11.5, fontWeight: 600, color, background: bg, border: "none", borderRadius: 7, padding: "5px 11px", cursor: "pointer", whiteSpace: "nowrap" };
}
