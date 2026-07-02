"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PlaybookCard, PlaybookBlock, Cadence, FlagKind } from "@/lib/playbook/types";

const NAVY = "#0f2147";
const input: React.CSSProperties = { width: "100%", fontSize: 13, padding: "7px 9px", borderRadius: 8, border: "1px solid #d7dce4", fontFamily: "inherit", boxSizing: "border-box" };
const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: NAVY, display: "block", marginBottom: 4 };

export function EditModule({ card, onClose, onSaved, patchUrl = "/api/admin/playbook/module" }: { card: PlaybookCard; onClose: () => void; onSaved: () => void; patchUrl?: string }) {
  const t = useTranslations("sharedCmp");
  const c = card.content;
  const [block, setBlock] = useState<PlaybookBlock>(c?.block ?? "core");
  const [cadence, setCadence] = useState<Cadence>(c?.cadence ?? "daily");
  const [roleNote, setRoleNote] = useState(c?.roleNote ?? "");
  const [countSource, setCountSource] = useState(c?.countSource ?? "");
  const [steps, setSteps] = useState<string[]>(c?.steps.map((s) => s.body) ?? [""]);
  const [flags, setFlags] = useState<{ kind: FlagKind; label: string }[]>(c?.flags ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const res = await fetch(patchUrl, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          navId: card.navId, block, cadence,
          role_note: roleNote.trim() || null,
          count_source: countSource.trim() || null,
          steps: steps.filter((s) => s.trim()).map((body, i) => ({ step_no: i + 1, body })),
          flags: flags.filter((f) => f.label.trim()),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Save failed.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 14, boxShadow: "0 20px 50px rgb(12 35 64 / 0.28)", overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "0.5px solid #eef1f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: NAVY, margin: 0 }}>{card.label}</p>
            <p style={{ fontSize: 11.5, color: "#9aa3b0", margin: "1px 0 0" }}>{card.href}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: 20, color: "#7a8494", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><span style={label}>{t("block")}</span>
              <select value={block} onChange={(e) => setBlock(e.target.value as PlaybookBlock)} style={input}>
                <option value="open">Open the day</option>
                <option value="core">Core operations</option>
                <option value="close">Close the day</option>
              </select>
            </div>
            <div><span style={label}>{t("cadence")}</span>
              <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)} style={input}>
                <option value="daily">Daily</option>
                <option value="2-3x_week">2–3× / week</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div><span style={label}>{t("role_note_one_line")}</span>
            <input style={input} value={roleNote} onChange={(e) => setRoleNote(e.target.value)} placeholder={t("what_this_surface_is_in_one_sentence")} />
          </div>

          <div><span style={label}>{t("live_count_source_optional")}</span>
            <input style={input} value={countSource} onChange={(e) => setCountSource(e.target.value)} placeholder={t("investors_pending_kyc_intro_requests_pending")} />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={label}>{t("steps")}</span>
              <button type="button" onClick={() => setSteps((s) => [...s, ""])} style={{ fontSize: 12, color: "#534AB7", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add step</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 12, color: "#9aa3b0", paddingTop: 8, width: 14 }}>{i + 1}</span>
                  <textarea value={s} onChange={(e) => setSteps((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} rows={2} style={{ ...input, resize: "vertical" }} placeholder={t("supports_bold_and_code")} />
                  <button type="button" onClick={() => setSteps((arr) => arr.filter((_, j) => j !== i))} aria-label="Remove step" style={{ background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 16, paddingTop: 4 }}>×</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={label}>{t("gates_guardrails")}</span>
              <button type="button" onClick={() => setFlags((f) => [...f, { kind: "guardrail", label: "" }])} style={{ fontSize: 12, color: "#534AB7", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add flag</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {flags.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 6 }}>
                  <select value={f.kind} onChange={(e) => setFlags((arr) => arr.map((x, j) => (j === i ? { ...x, kind: e.target.value as FlagKind } : x)))} style={{ ...input, width: 130 }}>
                    <option value="hard_gate">Hard gate</option>
                    <option value="guardrail">Guardrail</option>
                  </select>
                  <input value={f.label} onChange={(e) => setFlags((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} style={input} placeholder={t("rule")} />
                  <button type="button" onClick={() => setFlags((arr) => arr.filter((_, j) => j !== i))} aria-label="Remove flag" style={{ background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          </div>

          {err ? <p style={{ fontSize: 12, color: "#A32D2D", margin: 0 }}>{err}</p> : null}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "0.5px solid #eef1f5", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 13, color: "#5f5e5a", background: "#fff", border: "1px solid #d7dce4", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>{t("cancel")}</button>
          <button type="button" onClick={() => void save()} disabled={saving} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#534AB7", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
