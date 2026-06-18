"use client";

import { useState } from "react";
import type { FounderInvestorContactRecord } from "@/lib/founder-crm/types";
import type { OutreachCoachResult } from "@/app/api/founder/outreach-coach/route";

export type OutreachCoachSnapshot = {
  companyName: string;
  industry: string | null;
  businessDescription: string | null;
  revenueStage: string | null;
  fundingAmount: number | null;
  geography: string | null;
  founderGoals: string | null;
};

const ACCENT = "#534AB7";

// ---------------------------------------------------------------------------
// Copy button helper
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      style={{
        fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
        background: copied ? "#EAF3DE" : "#EEEDFE",
        color: copied ? "#1E6D3C" : ACCENT,
        border: "none", cursor: "pointer",
      }}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Coaching result display
// ---------------------------------------------------------------------------

function CoachingResult({ result, onReset }: { result: OutreachCoachResult; onReset: () => void }) {
  const [emailDraft, setEmailDraft] = useState(result.emailDraft);
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Framing callout */}
      <div style={{ background: "#EEEDFE", borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"
              stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" fill={ACCENT} />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: ".07em" }}>
            How to frame this
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#3C3489", margin: 0, lineHeight: 1.6 }}>{result.framing}</p>
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          style={{ fontSize: 10, color: ACCENT, background: "none", border: "none", cursor: "pointer", marginTop: 6, padding: 0, textDecoration: "underline" }}
        >
          {showWhy ? "Hide rationale" : "Why this framing?"}
        </button>
        {showWhy && (
          <p style={{ fontSize: 11, color: "#534AB7", margin: "6px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
            {result.whyFraming}
          </p>
        )}
      </div>

      {/* Subject line */}
      <div style={{ background: "white", border: "0.5px solid #e0e7ff", borderRadius: 10, padding: "10px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em" }}>Subject line</span>
          <CopyButton text={result.subjectLine} />
        </div>
        <p style={{ fontSize: 13, color: "#111827", margin: 0, fontWeight: 500 }}>{result.subjectLine}</p>
      </div>

      {/* Talking points */}
      <div style={{ background: "white", border: "0.5px solid #e0e7ff", borderRadius: 10, padding: "10px 14px" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", margin: "0 0 8px" }}>
          Key talking points
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {result.talkingPoints.map((point, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{
                flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
                background: "#EEEDFE", color: ACCENT,
                fontSize: 10, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{i + 1}</span>
              <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.5 }}>{point}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Watch out */}
      <div style={{ background: "#FAEEDA", borderRadius: 10, padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 12 }} aria-hidden="true">⚠</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#854F0B", textTransform: "uppercase", letterSpacing: ".07em" }}>Watch out</span>
        </div>
        <p style={{ fontSize: 12, color: "#633806", margin: 0, lineHeight: 1.5 }}>{result.watchOut}</p>
      </div>

      {/* Email draft */}
      <div style={{ background: "white", border: "0.5px solid #e0e7ff", borderRadius: 10, padding: "10px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em" }}>Email draft</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {result.source === "claude" && (
              <span style={{ fontSize: 9, fontWeight: 600, background: "#EEEDFE", color: ACCENT, padding: "2px 7px", borderRadius: 20 }}>
                ✦ AI-generated
              </span>
            )}
            <CopyButton text={emailDraft} />
          </div>
        </div>
        <textarea
          value={emailDraft}
          onChange={(e) => setEmailDraft(e.target.value)}
          rows={12}
          style={{
            width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: 11,
            lineHeight: 1.7, color: "#374151", background: "#fafafa",
            border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "10px 12px",
            outline: "none", boxSizing: "border-box",
          }}
        />
        <p style={{ fontSize: 10, color: "#9ca3af", margin: "6px 0 0" }}>
          Edit above, then copy — brackets indicate fields to fill with your real data.
        </p>
      </div>

      {/* Regenerate */}
      <button
        type="button"
        onClick={onReset}
        style={{
          fontSize: 11, fontWeight: 600, color: ACCENT, background: "none",
          border: `1px solid ${ACCENT}`, borderRadius: 8, padding: "8px 14px",
          cursor: "pointer", alignSelf: "flex-start",
        }}
      >
        ↺ Generate for a different investor
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InvestorOutreachCoach({
  contacts,
  companySnapshot,
}: {
  contacts: FounderInvestorContactRecord[];
  companySnapshot: OutreachCoachSnapshot;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [result, setResult] = useState<OutreachCoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  async function generate() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/founder/outreach-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investor: {
            name: selected.investor_name,
            firmName: selected.firm_name,
            investorType: selected.investor_type,
            preferredSectors: selected.preferred_sectors,
            preferredStages: selected.preferred_stages,
            checkSizeMin: selected.check_size_min,
            checkSizeMax: selected.check_size_max,
            geography: selected.geography,
            notes: selected.notes,
            matchScore: null,
          },
          companySnapshot,
        }),
      });
      const json = await res.json() as OutreachCoachResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Coach request failed.");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate coaching.");
    } finally {
      setLoading(false);
    }
  }

  if (contacts.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 8px" }}>No contacts in your CRM yet.</p>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Add investors to your CRM first, then come back for per-investor coaching.</p>
      </div>
    );
  }

  if (result) {
    return (
      <div>
        {selected && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", background: "#f8f7fd", borderRadius: 10, border: "0.5px solid #e0e7ff" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>
              {selected.investor_name[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{selected.investor_name}</p>
              {selected.firm_name && <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{selected.firm_name}</p>}
            </div>
          </div>
        )}
        <CoachingResult result={result} onReset={() => { setResult(null); setSelectedId(""); }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header description */}
      <div style={{ background: "#EEEDFE", borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"
              stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" fill={ACCENT} />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: ".07em" }}>
            Per-investor outreach coaching
          </span>
        </div>
        <p style={{ fontSize: 12, color: "#3C3489", margin: 0, lineHeight: 1.6 }}>
          Select an investor from your CRM. We&apos;ll analyse their profile and tell you exactly how to frame your outreach — before you send a word.
        </p>
      </div>

      {/* Selector */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
          Choose an investor
        </label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13, color: "#111827",
            border: "0.5px solid #d1d5db", background: "white", outline: "none", cursor: "pointer",
          }}
        >
          <option value="">— Select investor —</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.investor_name}{c.firm_name ? ` · ${c.firm_name}` : ""}{c.investor_type ? ` (${c.investor_type})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Selected investor preview */}
      {selected && (
        <div style={{ background: "white", border: "0.5px solid #e0e7ff", borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", margin: "0 0 8px" }}>
            Investor profile
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
            {[
              ["Type", selected.investor_type],
              ["Sectors", selected.preferred_sectors],
              ["Stages", selected.preferred_stages],
              ["Geography", selected.geography],
              ["Check size", selected.check_size_min || selected.check_size_max
                ? `$${(selected.check_size_min ?? 0).toLocaleString()}–$${(selected.check_size_max ?? 0).toLocaleString()}`
                : null],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string}>
                <p style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", margin: "0 0 1px" }}>{label}</p>
                <p style={{ fontSize: 11, color: "#374151", margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
          {selected.notes && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "0.5px solid #f3f4f6" }}>
              <p style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", margin: "0 0 2px" }}>Your notes</p>
              <p style={{ fontSize: 11, color: "#374151", margin: 0, lineHeight: 1.5 }}>{selected.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: "#FCEBEB", borderRadius: 8, padding: "10px 12px" }}>
          <p style={{ fontSize: 12, color: "#A32D2D", margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Generate button */}
      <button
        type="button"
        disabled={!selectedId || loading}
        onClick={() => void generate()}
        style={{
          padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          color: "white", background: !selectedId ? "#9ca3af" : ACCENT,
          border: "none", cursor: !selectedId ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
          opacity: loading ? 0.7 : 1, transition: "background 0.15s",
        }}
      >
        {loading ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Generating outreach strategy…
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"
                stroke="white" strokeWidth="2" strokeLinejoin="round" fill="white" />
            </svg>
            Generate outreach strategy for {selected?.investor_name ?? "this investor"}
          </>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
