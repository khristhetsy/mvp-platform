"use client";

import { useState } from "react";
import Link from "next/link";
import type { PitchDeckAnalysis, PitchDeckSection } from "@/app/api/founder/pitch-deck-analyze/route";

const ACCENT = "#534AB7";

const VERDICT_STYLES: Record<PitchDeckSection["verdict"], { bg: string; color: string; label: string }> = {
  strong:     { bg: "#dcfce7", color: "#065f46", label: "Strong"      },
  good:       { bg: "#EEEDFE", color: "#3C3489", label: "Good"        },
  needs_work: { bg: "#fef9c3", color: "#92400e", label: "Needs work"  },
  missing:    { bg: "#fee2e2", color: "#991b1b", label: "Missing"     },
};

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 50 ? ACCENT : "#f59e0b";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={size * 0.22} fontWeight={700} fill={color}>
        {score}
      </text>
    </svg>
  );
}

function SectionCard({ section }: { section: PitchDeckSection }) {
  const [expanded, setExpanded] = useState(false);
  const style = VERDICT_STYLES[section.verdict];
  return (
    <div style={{
      background: "white", border: "1px solid #e5e7eb",
      borderRadius: 12, overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14,
          padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        {/* Mini score ring */}
        <ScoreRing score={section.score} size={44} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{section.name}</span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: style.bg, color: style.color,
              borderRadius: 20, padding: "2px 9px",
            }}>
              {style.label}
            </span>
          </div>
          <p style={{ fontSize: 11, color: "#6b7280", margin: "3px 0 0", lineHeight: 1.4 }}>
            {expanded ? "" : section.feedback.slice(0, 70) + (section.feedback.length > 70 ? "…" : "")}
          </p>
        </div>

        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          style={{ flexShrink: 0, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f3f4f6" }}>
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.65, margin: "12px 0 0" }}>
            {section.feedback}
          </p>
          <div style={{
            marginTop: 12, background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 8, padding: "10px 14px",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", margin: "0 0 3px" }}>💡 Quick fix</p>
            <p style={{ fontSize: 12, color: "#78350f", margin: 0, lineHeight: 1.5 }}>{section.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function PitchDeckAnalyzerClient({
  hasPitchDeck,
  pitchDeckFileName,
  pitchDeckDate,
}: {
  hasPitchDeck: boolean;
  pitchDeckFileName: string | null;
  pitchDeckDate: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PitchDeckAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/pitch-deck-analyze", { method: "POST" });
      const json = await res.json() as { analysis?: PitchDeckAnalysis; error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "Analysis failed.");
      } else if (json.analysis) {
        setAnalysis(json.analysis);
      }
    } catch {
      setError("Unable to reach AI. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Status card */}
      <div style={{
        background: "white", border: "1px solid #e5e7eb",
        borderRadius: 14, padding: "20px 24px",
      }}>
        {hasPitchDeck ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "#EEEDFE",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={ACCENT} strokeWidth="2" />
                  <polyline points="14 2 14 8 20 8" stroke={ACCENT} strokeWidth="2" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>
                  {pitchDeckFileName ?? "Pitch deck"}
                </p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>
                  Uploaded {pitchDeckDate ? new Date(pitchDeckDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "recently"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void run()}
              disabled={loading}
              style={{
                background: loading ? "#a5b4fc" : ACCENT,
                color: "white", border: "none", cursor: loading ? "default" : "pointer",
                borderRadius: 10, padding: "10px 22px",
                fontSize: 13, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true">
                    <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Analyzing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" stroke="white" strokeWidth="2" strokeLinejoin="round" fill="white" />
                  </svg>
                  Analyze with AI
                </>
              )}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
              No pitch deck uploaded yet
            </p>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px", lineHeight: 1.5 }}>
              Upload your pitch deck to get AI-powered scored feedback from a VC perspective.
            </p>
            <Link
              href="/founder/documents"
              style={{
                display: "inline-block",
                background: ACCENT, color: "white",
                borderRadius: 10, padding: "10px 22px",
                fontSize: 13, fontWeight: 700, textDecoration: "none",
              }}
            >
              Upload pitch deck →
            </Link>
          </div>
        )}

        {error && (
          <p style={{ marginTop: 12, fontSize: 12, color: "#991b1b", background: "#fee2e2", borderRadius: 8, padding: "8px 12px" }}>
            {error}
          </p>
        )}
      </div>

      {/* Analysis results */}
      {analysis && (
        <>
          {/* Overall score */}
          <div style={{
            background: "white", border: `1px solid ${ACCENT}30`,
            borderRadius: 14, padding: "24px 28px",
            display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
          }}>
            <ScoreRing score={analysis.overallScore} size={80} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: ".07em", margin: "0 0 6px" }}>
                Overall score
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 8px", lineHeight: 1.4 }}>
                {analysis.overallVerdict}
              </p>
              {analysis.source === "ai" && (
                <span style={{ fontSize: 10, background: "#EEEDFE", color: ACCENT, borderRadius: 20, padding: "2px 10px", fontWeight: 600 }}>
                  AI analysis
                </span>
              )}
            </div>
          </div>

          {/* Investor reaction */}
          <div style={{
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 14, padding: "18px 22px",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".07em" }}>
              🎭 Simulated investor first impression
            </p>
            <p style={{ fontSize: 13, color: "#78350f", margin: 0, lineHeight: 1.6 }}>
              {analysis.investorReaction}
            </p>
          </div>

          {/* Strengths & Gaps */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#065f46", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: ".07em" }}>
                ✅ Top strengths
              </p>
              {analysis.topStrengths.map((s, i) => (
                <p key={i} style={{ fontSize: 12, color: "#166534", margin: "0 0 6px", lineHeight: 1.5 }}>
                  • {s}
                </p>
              ))}
            </div>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: ".07em" }}>
                🚧 Top gaps
              </p>
              {analysis.topGaps.map((g, i) => (
                <p key={i} style={{ fontSize: 12, color: "#7f1d1d", margin: "0 0 6px", lineHeight: 1.5 }}>
                  • {g}
                </p>
              ))}
            </div>
          </div>

          {/* Section-by-section */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 12px" }}>
              Section-by-section breakdown
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {analysis.sections.map((s) => (
                <SectionCard key={s.name} section={s} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
