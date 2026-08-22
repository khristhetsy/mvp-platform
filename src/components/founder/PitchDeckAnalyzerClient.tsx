"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { PitchDeckAnalysis, PitchDeckSection } from "@/app/api/founder/pitch-deck-analyze/route";

const ACCENT = "#2E78F5";

const VERDICT_STYLES: Record<PitchDeckSection["verdict"], { bg: string; color: string; label: string }> = {
  strong:     { bg: "#dcfce7", color: "#065f46", label: "Strong"      },
  good:       { bg: "#EEEDFE", color: "#1A6CE4", label: "Good"        },
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
  const t = useTranslations("founderCmp");
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
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="13" /><path d="M12 17h.01" />
              </svg>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", margin: 0 }}>{t("quick_fix")}</p>
            </div>
            <p style={{ fontSize: 12, color: "#78350f", margin: 0, lineHeight: 1.5 }}>{section.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ onClick, disabled, icon, label }: { onClick: () => void; disabled?: boolean; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        border: "1px solid #cbd5e1", background: "white", color: "#475569",
        borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}{label}
    </button>
  );
}

function analysisToMarkdown(a: PitchDeckAnalysis, company: string): string {
  const lines = [
    `# Pitch deck analysis — ${company}`,
    ``,
    `**Overall score:** ${a.overallScore}/100`,
    ``,
    `${a.overallVerdict}`,
    ``,
    `## Simulated investor first impression`,
    a.investorReaction,
    ``,
    `## Top strengths`,
    ...a.topStrengths.map((s) => `- ${s}`),
    ``,
    `## Top gaps`,
    ...a.topGaps.map((g) => `- ${g}`),
    ``,
    `## Section-by-section breakdown`,
    ...a.sections.flatMap((s) => [
      ``,
      `### ${s.name} — ${s.score}/100 (${s.verdict.replace("_", " ")})`,
      s.feedback,
      `_Quick fix: ${s.tip}_`,
    ]),
  ];
  return lines.join("\n");
}

export function PitchDeckAnalyzerClient({
  hasPitchDeck,
  pitchDeckFileName,
  pitchDeckDate,
  initialAnalysis = null,
  initialSavedAt = null,
}: {
  hasPitchDeck: boolean;
  pitchDeckFileName: string | null;
  pitchDeckDate: string | null;
  initialAnalysis?: PitchDeckAnalysis | null;
  initialSavedAt?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PitchDeckAnalysis | null>(initialAnalysis);
  const [error, setError] = useState<string | null>(null);
  const [limitInfo, setLimitInfo] = useState<{ limit: number | null; period: string; resetAt: string | null } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  function fmtResetDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  async function run() {
    setLoading(true);
    setError(null);
    setLimitInfo(null);
    try {
      const res = await fetch("/api/founder/pitch-deck-analyze", { method: "POST" });
      const json = await res.json() as { analysis?: PitchDeckAnalysis; savedAt?: string | null; error?: string; limit?: number | null; period?: string; resetAt?: string | null };
      if (res.status === 429 && json.error === "usage_limit_reached") {
        setLimitInfo({ limit: json.limit ?? null, period: json.period ?? "week", resetAt: json.resetAt ?? null });
      } else if (!res.ok || json.error) {
        setError(json.error ?? "Analysis failed.");
      } else if (json.analysis) {
        setAnalysis(json.analysis);
        if (json.savedAt) setSavedAt(json.savedAt);
      }
    } catch {
      setError("Unable to reach AI. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!analysis) return;
    setSaving(true);
    try {
      const res = await fetch("/api/founder/pitch-deck-analyze/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      const json = await res.json().catch(() => ({})) as { savedAt?: string };
      if (res.ok && json.savedAt) setSavedAt(json.savedAt);
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    setExportingPdf(true);
    try {
      const res = await fetch("/api/founder/pitch-deck-analyze/pdf", { method: "POST" });
      if (!res.ok) { setError("Could not generate the PDF. Save your analysis first."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Pitch deck analysis.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingPdf(false);
    }
  }

  function exportMarkdown() {
    if (!analysis) return;
    const md = analysisToMarkdown(analysis, pitchDeckFileName ?? "Your company");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Pitch deck analysis.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{"@media print { .pda-toolbar, .pda-analyze-card { display: none !important; } nav, aside, header { display: none !important; } }"}</style>

      {/* Status card */}
      <div className="pda-analyze-card" style={{
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

        {limitInfo && (
          <div style={{ marginTop: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a", margin: 0 }}>
                You&rsquo;ve used your {limitInfo.limit === 1 ? "" : `${limitInfo.limit} `}analysis{limitInfo.limit === 1 ? "" : "es"} for this {limitInfo.period}
              </p>
              <p style={{ fontSize: 12, color: "#1e40af", margin: "3px 0 0", lineHeight: 1.5 }}>
                {limitInfo.resetAt ? `Your next run unlocks ${fmtResetDate(limitInfo.resetAt)}. ` : ""}
                Your saved report stays available to view, print, and export.{" "}
                <Link href="/founder/settings/billing" style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}>Upgrade for more runs</Link>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Analysis results */}
      {analysis && (
        <>
          {/* Action toolbar — Save / Print / PDF / Export */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }} className="pda-toolbar">
            {savedAt && <span style={{ fontSize: 12, color: "#059669", marginRight: "auto" }}>Saved {fmtTime(savedAt)}</span>}
            <ToolbarButton onClick={() => void save()} disabled={saving} label={saving ? "Saving…" : "Save"} icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            } />
            <ToolbarButton onClick={() => window.print()} label="Print" icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            } />
            <ToolbarButton onClick={() => void downloadPdf()} disabled={exportingPdf} label={exportingPdf ? "PDF…" : "PDF"} icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            } />
            <ToolbarButton onClick={exportMarkdown} label="Export" icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            } />
          </div>

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
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", margin: 0, textTransform: "uppercase", letterSpacing: ".07em" }}>
                Simulated investor first impression
              </p>
            </div>
            <p style={{ fontSize: 13, color: "#78350f", margin: 0, lineHeight: 1.6 }}>
              {analysis.investorReaction}
            </p>
          </div>

          {/* Strengths & Gaps */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#065f46", margin: 0, textTransform: "uppercase", letterSpacing: ".07em" }}>
                  Top strengths
                </p>
              </div>
              {analysis.topStrengths.map((s, i) => (
                <p key={i} style={{ fontSize: 12, color: "#166534", margin: "0 0 6px", lineHeight: 1.5 }}>
                  • {s}
                </p>
              ))}
            </div>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#991b1b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", margin: 0, textTransform: "uppercase", letterSpacing: ".07em" }}>
                  Top gaps
                </p>
              </div>
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
