"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_MATCHING_THRESHOLDS,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  countAtOrAbove,
  validThreshold,
  type MatchingThresholds,
} from "@/lib/matching/matching-thresholds-shared";

const BUCKETS = [60, 50, 45, 40];
const box: React.CSSProperties = { border: "0.5px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 13, width: 64, textAlign: "center", color: "#0F172A", background: "#fff" };
const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#0F172A", minWidth: 190 };
const hint: React.CSSProperties = { fontSize: 12, color: "var(--muted-foreground)" };
const btn: React.CSSProperties = { borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };

/** Matching pass thresholds (Scheduled jobs, Matching pass, Settings), with live counts. */
export function MatchingSettings() {
  const [loaded, setLoaded] = useState<{ thresholds: MatchingThresholds; scores: number[] } | null>(null);
  const [readiness, setReadiness] = useState("");
  const [match, setMatch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/scheduled-jobs/matching-settings")
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { thresholds?: MatchingThresholds; scores?: number[]; error?: string } | null;
        if (!live) return;
        if (!res.ok || !body?.thresholds) {
          setMessage({ ok: false, text: body?.error ?? "Couldn't load the settings. Try again." });
          return;
        }
        setLoaded({ thresholds: body.thresholds, scores: body.scores ?? [] });
        setReadiness(String(body.thresholds.readiness));
        setMatch(String(body.thresholds.match));
      })
      .catch(() => live && setMessage({ ok: false, text: "Couldn't load the settings. Try again." }));
    return () => {
      live = false;
    };
  }, []);

  if (!loaded) {
    return <p style={{ margin: 0, fontSize: 12, color: message ? "#791F1F" : "var(--muted-foreground)" }}>{message?.text ?? "Loading…"}</p>;
  }

  const r = Number(readiness);
  const m = Number(match);
  const rOk = validThreshold(r);
  const mOk = validThreshold(m);
  const scores = loaded.scores;
  const best = scores[0] ?? null;
  const qualifying = rOk ? countAtOrAbove(scores, r) : null;
  const changed = rOk && mOk && (r !== loaded.thresholds.readiness || m !== loaded.thresholds.match);

  async function save(next: MatchingThresholds) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/scheduled-jobs/matching-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => null);
    const body = res ? ((await res.json().catch(() => null)) as { error?: string } | null) : null;
    setBusy(false);
    if (!res?.ok) {
      setMessage({ ok: false, text: body?.error ?? "Couldn't save. Try again." });
      return;
    }
    setLoaded((l) => (l ? { ...l, thresholds: next } : l));
    setReadiness(String(next.readiness));
    setMatch(String(next.match));
    setMessage({ ok: true, text: `Saved: readiness ${next.readiness}, match score ${next.match}. Used from the next run.` });
  }

  const cell = (on: boolean): React.CSSProperties => ({
    border: `0.5px solid ${on ? "#C9CCF6" : "#e2e6ed"}`,
    background: on ? "#EEF0FF" : "#FAFBFD",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 12,
    color: "#334155",
  });

  return (
    <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, background: "#fff", padding: 14, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <span style={lbl}>Readiness needed to be matched</span>
        <input aria-label="Readiness needed to be matched" type="number" min={THRESHOLD_MIN} max={THRESHOLD_MAX} value={readiness} onChange={(e) => setReadiness(e.target.value)} style={box} />
        <span style={hint}>CRR score, 0 to 100. Companies below this aren&apos;t matched at all.</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6 }}>
        {BUCKETS.map((b) => (
          <div key={b} style={cell(rOk && r === b)}>
            <b style={{ display: "block", fontSize: 15, color: "#0F172A" }}>{countAtOrAbove(scores, b)}</b>at {b} or above
          </div>
        ))}
        <div style={cell(false)}>
          <b style={{ display: "block", fontSize: 15, color: "#0F172A" }}>{scores.length}</b>scored in total
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12.5, borderRadius: 6, padding: "6px 9px", color: qualifying ? "#27500A" : "#633806", background: qualifying ? "#EAF3DE" : "#FAEEDA" }}>
        {rOk
          ? `At ${r}, ${qualifying} of ${scores.length} companies qualify.${best !== null ? ` The highest score today is ${Math.round(best)}.` : ""}`
          : `Enter a whole number from ${THRESHOLD_MIN} to ${THRESHOLD_MAX}.`}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <span style={lbl}>Match score needed</span>
        <input aria-label="Match score needed" type="number" min={THRESHOLD_MIN} max={THRESHOLD_MAX} value={match} onChange={(e) => setMatch(e.target.value)} style={box} />
        <span style={hint}>How well a company and an investor fit, 0 to 100. Pairs below this aren&apos;t suggested.</span>
      </div>
      {!mOk && <p style={{ margin: 0, fontSize: 12, color: "#791F1F" }}>Match score: enter a whole number from {THRESHOLD_MIN} to {THRESHOLD_MAX}.</p>}

      {message && <p role="status" style={{ margin: 0, fontSize: 12.5, color: message.ok ? "#27500A" : "#791F1F" }}>{message.text}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" disabled={busy} onClick={() => void save(DEFAULT_MATCHING_THRESHOLDS)} style={{ ...btn, border: "0.5px solid #e2e6ed", background: "#fff", color: "#334155" }}>
          Reset to 60 and 60
        </button>
        <button type="button" disabled={busy || !changed} onClick={() => void save({ readiness: r, match: m })} style={{ ...btn, border: "none", background: "#4F46E5", color: "#fff", opacity: busy || !changed ? 0.5 : 1 }}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      <span style={hint}>Used from the next run. Run now on Edit applies it straight away. Changes are logged with your name.</span>
    </div>
  );
}
