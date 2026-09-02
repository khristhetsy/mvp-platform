"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { MarketClaimReport, ClaimSeverity } from "@/lib/founder/market-claim";

const C = {
  navy: "#0A1A40", blue: "#1A6CE4", steel: "#185FA5", ink: "#101828", muted: "#5A6478",
  hair: "#DCE1EA", wash: "#F5F7FA", amber: "#B0700F", amberBg: "#FDF4E4", red: "#A32D2D",
  redBg: "#FBECEC", green: "#2F6B22", greenBg: "#EDF5E8",
};

function scoreColor(n: number): string {
  if (n >= 70) return C.green;
  if (n >= 45) return C.amber;
  return C.red;
}

const SEV: Record<ClaimSeverity, { border: string; bg: string; fg: string; label: string }> = {
  high: { border: C.red, bg: C.redBg, fg: C.red, label: "Open" },
  med: { border: C.amber, bg: C.amberBg, fg: C.amber, label: "Open" },
  clear: { border: C.green, bg: C.greenBg, fg: C.green, label: "Answered" },
};

type Tab = "report" | "whatif" | "sources";

export function MarketClaimClient({
  companyName, industry, stage, hasDeck, deckFileName,
}: {
  companyName: string;
  industry: string | null;
  stage: string | null;
  hasDeck: boolean;
  deckFileName: string | null;
}) {
  const [report, setReport] = useState<MarketClaimReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("report");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [source, setSource] = useState<"deck" | "upload">(hasDeck ? "deck" : "upload");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  function pickUpload(f: File | null) {
    if (!f) { setUploadFile(null); return; }
    if (f.type && f.type !== "application/pdf") { setError("Upload a PDF — that's what reviewers read."); return; }
    if (f.size > 25 * 1024 * 1024) { setError("That file is over 25 MB. Try a lighter PDF."); return; }
    setError(null);
    setUploadFile(f);
    setSource("upload");
  }

  async function grade() {
    if (source === "upload" && !uploadFile) { setError("Choose a PDF to grade, or switch to your data-room deck."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = source === "upload" && uploadFile
        ? await fetch("/api/founder/market-claim", { method: "POST", body: (() => { const fd = new FormData(); fd.append("file", uploadFile); return fd; })() })
        : await fetch("/api/founder/market-claim", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429 && data.error === "usage_limit_reached") {
        setError(`You've used all ${data.limit ?? ""} grading runs for this period. It resets ${data.resetAt ? new Date(data.resetAt).toLocaleDateString() : "soon"}.`);
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Grading failed. Please try again.");
        return;
      }
      if (data.report?.source === "fallback") {
        setError(data.report.summary ?? "The grader couldn't run — please try again.");
        return;
      }
      setReport(data.report as MarketClaimReport);
      setSelected(new Set());
      setTab("report");
    } catch {
      setError("Grading failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const projected = useMemo(() => {
    if (!report) return 0;
    const add = report.fixes.reduce((sum, f, i) => sum + (selected.has(i) ? f.points : 0), 0);
    return Math.min(100, report.overallScore + add);
  }, [report, selected]);

  // ── Start / empty state ───────────────────────────────────────────────────
  if (!report) {
    return (
      <div style={{ maxWidth: 720 }}>
        <div style={{ border: `1px solid ${C.hair}`, borderRadius: 10, background: "#fff", padding: "28px 30px" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.navy }}>Grade your market claim</h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: C.muted, lineHeight: 1.6, maxWidth: "58ch" }}>
            We read your market narrative — sizing, competitors, timing, and the evidence behind them — the way an
            institutional reviewer reads it, straight from your pitch deck. You&apos;ll see the objections reviewers raise
            and the concrete fixes that clear them.
          </p>

          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, margin: "20px 0 8px" }}>Source</div>

          {/* Option 1 — data-room deck */}
          <button
            type="button"
            onClick={() => hasDeck && setSource("deck")}
            disabled={!hasDeck}
            style={{
              width: "100%", textAlign: "left", display: "flex", gap: 12, alignItems: "flex-start", cursor: hasDeck ? "pointer" : "not-allowed",
              border: `${source === "deck" ? 2 : 1}px solid ${source === "deck" ? C.blue : C.hair}`, borderRadius: 10,
              padding: source === "deck" ? "14px 15px" : "15px 16px", background: hasDeck ? "#fff" : C.wash, opacity: hasDeck ? 1 : 0.7,
            }}
          >
            <span style={{ width: 18, height: 18, borderRadius: "50%", flex: "none", marginTop: 1, border: source === "deck" ? `5px solid ${C.blue}` : `1.5px solid ${C.hair}` }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.ink }}>Use your pitch deck from the data room</span>
              {hasDeck ? (
                <span style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, background: C.wash, borderRadius: 8, padding: "9px 11px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 500, padding: "3px 6px", borderRadius: 3, background: C.navy, color: "#fff" }}>PDF</span>
                  <span style={{ flex: 1, fontSize: 13, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deckFileName ?? "Your pitch deck"}</span>
                  <span style={{ fontSize: 12, color: C.green }}>Latest · ready</span>
                </span>
              ) : (
                <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: C.muted }}>No deck in your data room yet — upload one below, or add it to your{" "}
                  <Link href="/founder/readiness/data-room" style={{ color: C.steel, fontWeight: 500 }}>data room</Link>.
                </span>
              )}
            </span>
          </button>

          {/* Option 2 — one-off upload */}
          <div
            onClick={() => setSource("upload")}
            style={{
              marginTop: 10, display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer",
              border: `${source === "upload" ? 2 : 1}px solid ${source === "upload" ? C.blue : C.hair}`, borderRadius: 10,
              padding: source === "upload" ? "14px 15px" : "15px 16px", background: "#fff",
            }}
          >
            <span style={{ width: 18, height: 18, borderRadius: "50%", flex: "none", marginTop: 1, border: source === "upload" ? `5px solid ${C.blue}` : `1.5px solid ${C.hair}` }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Upload a different file</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>Grade a specific deck or one-pager. Used for this grade only — it doesn&apos;t change your data room.</div>
              {uploadFile ? (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, background: C.wash, borderRadius: 8, padding: "9px 11px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 500, padding: "3px 6px", borderRadius: 3, background: C.navy, color: "#fff" }}>PDF</span>
                  <span style={{ flex: 1, fontSize: 13, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{uploadFile.name}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setUploadFile(null); if (uploadRef.current) uploadRef.current.value = ""; }} style={{ fontSize: 12, color: C.steel, background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                </div>
              ) : (
                <button type="button" onClick={(e) => { e.stopPropagation(); uploadRef.current?.click(); }}
                  style={{ marginTop: 10, width: "100%", border: `2px dashed ${C.hair}`, borderRadius: 8, padding: 18, textAlign: "center", background: C.wash, cursor: "pointer" }}>
                  <span style={{ fontSize: 13, color: C.muted }}><b style={{ color: C.ink }}>Drop a PDF here</b> or <span style={{ color: C.blue, fontWeight: 500 }}>choose file</span></span>
                  <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 3 }}>PDF up to 25 MB · used for this grade only</span>
                </button>
              )}
              <input ref={uploadRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pickUpload(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          <div style={{ marginTop: 16, background: C.wash, borderRadius: 6, padding: "12px 14px", fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
            <b style={{ color: C.ink, fontWeight: 500 }}>This stays yours.</b> The grader reads a copy of your deck. Nothing becomes
            visible to any investor unless you share it deliberately.
          </div>

          {error && (
            <div style={{ marginTop: 16, border: `1px solid ${C.red}`, background: C.redBg, borderRadius: 6, padding: "11px 14px", fontSize: 13, color: C.red }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 22, display: "flex", gap: 10, alignItems: "center" }}>
            {(() => {
              const canGrade = !loading && (source === "upload" ? Boolean(uploadFile) : hasDeck);
              return (
                <button
                  type="button"
                  onClick={grade}
                  disabled={!canGrade}
                  style={{
                    fontSize: 14, fontWeight: 500, borderRadius: 6, padding: "10px 18px", border: "none",
                    background: canGrade ? C.blue : "#9DB4DE", color: "#fff", cursor: canGrade ? "pointer" : "default",
                  }}
                >
                  {loading ? "Grading… about 40 seconds" : "Grade my market claim"}
                </button>
              );
            })()}
            <span style={{ fontSize: 12, color: C.muted }}>{source === "upload" ? "Grades the uploaded file." : "Reads your latest deck."} Uses one AI grading run.</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const openObjections = report.objections.filter((o) => o.severity !== "clear").length;

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Action bar */}
      <div className="noprint" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 3, background: C.wash, borderRadius: 7, padding: 3 }} role="tablist">
          {([["report", "Report"], ["whatif", "What-if"], ["sources", "Sources"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              style={{
                fontSize: 13, fontWeight: 500, border: 0, borderRadius: 5, padding: "6px 14px", cursor: "pointer",
                background: tab === id ? C.blue : "transparent", color: tab === id ? "#fff" : C.muted,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => window.print()} style={btn}>Print / save as PDF</button>
        <button type="button" onClick={grade} disabled={loading} style={btn}>{loading ? "Grading…" : "Grade again"}</button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.hair}`, borderRadius: 8, padding: "36px 40px 40px" }}>
        {/* Masthead */}
        <div style={{ borderBottom: `2px solid ${C.navy}`, paddingBottom: 14, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>iCap<span style={{ color: C.blue }}>OS</span> · Investor-graded market claim</div>
          <h1 style={{ margin: "10px 0 6px", fontSize: 27, fontWeight: 500, letterSpacing: "-0.02em", color: C.navy, lineHeight: 1.15 }}>{companyName}</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            {[stage, industry].filter(Boolean).join(" · ") || "Market narrative"} · Graded {new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {tab === "report" && (
          <>
            <div style={{ display: "flex", gap: 28, alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontFamily: "monospace", fontWeight: 500, fontSize: 60, lineHeight: 1, color: C.navy }}>
                {report.overallScore}<span style={{ fontSize: 20, color: C.muted, fontWeight: 400 }}>/100</span>
              </div>
              <div style={{ flex: 1, paddingTop: 6 }}>
                <div style={{ height: 8, background: C.wash, borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${report.overallScore}%`, background: scoreColor(report.overallScore) }} />
                </div>
                <p style={{ margin: 0, fontSize: 14, color: C.muted }}>{report.summary}</p>
              </div>
            </div>

            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "26px 0 12px", color: C.ink }}>Where the points sit</h3>
            {report.dimensions.map((d) => (
              <div key={d.name} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span>{d.name}</span>
                  <b style={{ fontFamily: "monospace", fontWeight: 500, fontSize: 12, color: scoreColor(d.score) }}>{d.score}</b>
                </div>
                <div style={{ height: 7, background: C.wash, borderRadius: 4 }}>
                  <div style={{ height: "100%", width: `${d.score}%`, borderRadius: 4, background: scoreColor(d.score) }} />
                </div>
              </div>
            ))}

            <h2 style={h2}>What investors will push back on</h2>
            <p style={sub}>Ranked by how hard the objection lands in an institutional review.</p>
            {report.objections.map((o, i) => {
              const s = SEV[o.severity];
              return (
                <div key={i} style={{ border: `1px solid ${C.hair}`, borderLeft: `4px solid ${s.border}`, borderRadius: 6, padding: "16px 18px", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{o.title}</h3>
                      {o.category && <span style={{ fontFamily: "monospace", fontSize: 11, color: C.steel, display: "block", margin: "1px 0 6px" }}>{o.category}</span>}
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap", background: s.bg, color: s.fg }}>{s.label}</span>
                  </div>
                  {o.body && <p style={{ margin: 0, fontSize: 14, color: C.muted }}>{o.body}</p>}
                  {o.severity !== "clear" && o.fix && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.hair}`, fontSize: 14, color: C.ink }}>
                      <b style={{ fontWeight: 600, color: C.navy }}>Fix:</b> {o.fix}
                    </div>
                  )}
                </div>
              );
            })}

            {report.competitors.length > 0 && (
              <>
                <h2 style={h2}>Competitive set</h2>
                <p style={sub}>Extracted from your deck. Correct anything the grader misread.</p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th style={th}>Company</th><th style={th}>Stage</th><th style={{ ...th, textAlign: "right" }}>Raised</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.competitors.map((c, i) => (
                      <tr key={i}>
                        <td style={td}>{c.company}</td>
                        <td style={td}>{c.stage || "—"}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontSize: 13 }}>{c.raised}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div style={{ background: C.wash, borderRadius: 6, padding: "16px 18px", marginTop: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: C.steel }}>
                <b>Before you distribute.</b> {openObjections > 0
                  ? `Clearing your ${openObjections} open objection${openObjections > 1 ? "s" : ""} lifts the claim to a projected ${projectedFromAll(report)}. Distribution to matched investors remains available at any grade.`
                  : "Your market claim reads clean. Distribution to matched investors is available whenever you're ready."}
              </p>
            </div>
          </>
        )}

        {tab === "whatif" && (
          <>
            <h2 style={{ ...h2, marginTop: 0 }}>What-if scenario</h2>
            <p style={sub}>Select the fixes you intend to make. The projected grade updates as you go.</p>
            <div style={{ border: `1px solid ${C.hair}`, borderRadius: 6, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, color: C.muted }}>Projected grade</div>
                  <div style={{ fontFamily: "monospace", fontWeight: 500, fontSize: 34, lineHeight: 1, color: C.navy }}>{projected}</div>
                </div>
                <div style={{ fontSize: 13, color: C.muted }}>
                  {projected === report.overallScore ? "Baseline, nothing selected" : `+${projected - report.overallScore} from a baseline of ${report.overallScore}`}
                </div>
              </div>
              <div style={{ height: 8, background: C.wash, borderRadius: 4, marginBottom: 16 }}>
                <div style={{ height: "100%", width: `${projected}%`, borderRadius: 4, background: scoreColor(projected) }} />
              </div>

              {report.fixes.length === 0 && <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>No open fixes — your claim already reads clean.</p>}
              {report.fixes.map((f, i) => (
                <label key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 0", borderTop: `1px solid ${C.hair}`, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(i); else n.delete(i); return n; })}
                    style={{ marginTop: 4, width: 16, height: 16, accentColor: C.blue, flex: "none" }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, display: "block" }}>{f.name}</span>
                    {f.effort && <span style={{ fontSize: 12, color: C.muted }}>{f.effort}</span>}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: C.steel, flex: "none" }}>+{f.points}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {tab === "sources" && (
          <>
            <h2 style={{ ...h2, marginTop: 0 }}>Sources</h2>
            <p style={sub}>Where each graded value came from.</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
              <thead>
                <tr><th style={{ ...th, width: "30%" }}>Field</th><th style={{ ...th, width: "44%" }}>Value</th><th style={{ ...th, width: "26%" }}>Source</th></tr>
              </thead>
              <tbody>
                {report.extracted.map((f, i) => {
                  const prov = f.source === "deck"
                    ? { bg: C.amberBg, fg: C.amber, label: "your deck" }
                    : f.source === "profile"
                      ? { bg: "#E8F0FB", fg: C.steel, label: "your profile" }
                      : { bg: C.wash, fg: C.muted, label: "missing" };
                  return (
                    <tr key={i}>
                      <td style={td}>{f.field}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 13 }}>
                        {f.value}
                        {f.cite && <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted, display: "block", marginTop: 3, lineHeight: 1.45 }}>{f.cite}</span>}
                      </td>
                      <td style={td}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, padding: "2px 7px", borderRadius: 3, whiteSpace: "nowrap", background: prov.bg, color: prov.fg }}>{prov.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {deckFileName && (
              <>
                <h2 style={h2}>Document read</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.hair}`, fontSize: 14 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 500, padding: "3px 6px", borderRadius: 3, background: C.navy, color: "#fff" }}>PDF</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deckFileName}</span>
                </div>
              </>
            )}
          </>
        )}

        <footer style={{ marginTop: 36, paddingTop: 16, borderTop: `1px solid ${C.hair}`, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          Grades, dimension scores, and scenario point values are AI-generated from your document and are directionally
          modeled, not measured outcomes. This report is not an offer to sell securities and is not a prediction of a
          funding outcome.
        </footer>
      </div>

      {error && (
        <div className="noprint" style={{ marginTop: 14, border: `1px solid ${C.red}`, background: C.redBg, borderRadius: 6, padding: "11px 14px", fontSize: 13, color: C.red }}>{error}</div>
      )}
    </div>
  );
}

// Projected grade if every open fix is applied (used in the "before you distribute" callout).
function projectedFromAll(r: MarketClaimReport): number {
  return Math.min(100, r.overallScore + r.fixes.reduce((s, f) => s + f.points, 0));
}

const btn: React.CSSProperties = {
  fontSize: 13, fontWeight: 500, color: C.ink, background: "#fff", border: `1px solid ${C.hair}`,
  borderRadius: 6, padding: "7px 12px", cursor: "pointer",
};
const h2: React.CSSProperties = { fontSize: 17, fontWeight: 500, color: C.navy, margin: "34px 0 4px", letterSpacing: "-0.01em" };
const sub: React.CSSProperties = { fontSize: 13, color: C.muted, margin: "0 0 16px" };
const th: React.CSSProperties = { textAlign: "left", fontWeight: 500, fontSize: 12, color: C.muted, borderBottom: `1px solid ${C.hair}`, padding: "0 8px 8px 0" };
const td: React.CSSProperties = { padding: "9px 8px 9px 0", borderBottom: `1px solid ${C.hair}`, verticalAlign: "top" };
