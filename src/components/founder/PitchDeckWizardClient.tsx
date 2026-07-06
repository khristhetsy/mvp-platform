"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DECK_SLIDES, DECK_GROUPS } from "@/lib/pitch-deck/slides";

type SlideContent = { headline: string; body: string; aiGenerated: boolean };
type Deck = { slides: Record<string, SlideContent>; theme: string; status: string; shareToken: string | null };
type ChartData = { projections: { revenue: number; grossProfit: number }[]; allocation: { label: string; pct: number }[]; market: { tam: number | null; sam: number | null; som: number | null } };

const NAVY = "#0C2340";
const INDIGO = "#2E78F5";
const CHART_HEX = ["#85B7EB", "#5DCAA5", "#EF9F27", "#9085e9"];
function chMoney(n: number): string {
  const a = Math.abs(n);
  return a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}k` : `$${Math.round(a)}`;
}

export function PitchDeckWizardClient() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [activeId, setActiveId] = useState("title");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/founder/pitch-deck");
    if (res.ok) { const d = await res.json(); setDeck(d.deck); setChartData(d.chartData ?? null); setShareUrl(null); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { void load(); }, [load]);

  const doneCount = useMemo(() => {
    if (!deck) return 0;
    return DECK_SLIDES.filter((s) => (deck.slides[s.id]?.body ?? "").trim() && !(deck.slides[s.id]?.body ?? "").includes("[Add your points")).length;
  }, [deck]);

  function setSlide(id: string, patch: Partial<SlideContent>) {
    setDeck((d) => d ? { ...d, slides: { ...d.slides, [id]: { ...(d.slides[id] ?? { headline: "", body: "", aiGenerated: false }), ...patch } } } : d);
  }

  async function save(silent = false) {
    if (!deck) return;
    setBusy(true); if (!silent) setMsg(null);
    try {
      const res = await fetch("/api/founder/pitch-deck", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slides: deck.slides, theme: deck.theme }) });
      if (!res.ok) throw new Error();
      if (!silent) setMsg("Saved.");
    } catch { if (!silent) setMsg("Save failed."); } finally { setBusy(false); }
  }

  async function draft(id: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/founder/pitch-deck/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slideId: id }) });
      const data = await res.json();
      if (res.ok && data.draft) setSlide(id, { headline: data.draft.headline, body: data.draft.body, aiGenerated: data.draft.aiGenerated });
    } finally { setBusy(false); }
  }

  async function share() {
    setBusy(true);
    try {
      const res = await fetch("/api/founder/pitch-deck/share", { method: "POST" });
      const data = await res.json();
      if (res.ok) { setShareUrl(data.url); try { await navigator.clipboard.writeText(data.url); } catch { /* ignore */ } }
    } finally { setBusy(false); }
  }

  async function finalize() { setBusy(true); try { await save(true); await fetch("/api/founder/pitch-deck/finalize", { method: "POST" }); setMsg("Finalized."); await load(); } finally { setBusy(false); } }

  if (!deck) return <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</p>;

  const active = deck.slides[activeId] ?? { headline: "", body: "", aiGenerated: false };
  const activeDef = DECK_SLIDES.find((s) => s.id === activeId)!;
  const activeIdx = DECK_SLIDES.findIndex((s) => s.id === activeId);
  const btn: React.CSSProperties = { fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "7px 13px", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 };
  const inp: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box", width: "100%" };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{doneCount} / {DECK_SLIDES.length} slides done</div>
          <div style={{ height: 6, background: "var(--muted)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(doneCount / DECK_SLIDES.length) * 100}%`, height: 6, background: INDIGO, borderRadius: 4 }} /></div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => save()} disabled={busy} style={btn}><i className="ti ti-device-floppy" aria-hidden="true" /> Save</button>
          <a href="/api/founder/pitch-deck/pdf" style={btn}><i className="ti ti-file-type-pdf" aria-hidden="true" /> PDF</a>
          <a href="/api/founder/pitch-deck/pptx" style={btn}><i className="ti ti-presentation" aria-hidden="true" /> PPTX</a>
          <button onClick={share} disabled={busy} style={btn}><i className="ti ti-link" aria-hidden="true" /> Share link</button>
          <button onClick={finalize} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: INDIGO, border: "none", borderRadius: 8, padding: "7px 15px", cursor: "pointer" }}>Finalize</button>
        </div>
        {msg && <span style={{ fontSize: 11.5, color: msg.includes("fail") ? "#A32D2D" : "#0F6E56", width: "100%" }}>{msg}</span>}
        {shareUrl && <div style={{ width: "100%", fontSize: 11.5, color: "#185FA5" }}>Read-only link copied: <a href={shareUrl} style={{ color: "#185FA5" }}>{shareUrl}</a></div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 14, alignItems: "start" }}>
        {/* Slide nav */}
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 10 }}>
          {DECK_GROUPS.map((grp) => (
            <div key={grp} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".05em", color: "var(--muted-foreground)", textTransform: "uppercase", padding: "6px 8px" }}>{grp}</div>
              {DECK_SLIDES.filter((s) => s.group === grp).map((s) => {
                const filled = (deck.slides[s.id]?.body ?? "").trim() && !(deck.slides[s.id]?.body ?? "").includes("[Add your points");
                const on = s.id === activeId;
                return (
                  <button key={s.id} onClick={() => setActiveId(s.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: on ? 600 : 400, color: on ? "#185FA5" : "var(--foreground)", background: on ? "#E6F1FB" : "transparent", border: "none", borderRadius: 7, padding: "7px 8px", cursor: "pointer" }}>
                    <span style={{ color: filled ? INDIGO : "var(--muted-foreground)", fontSize: 9 }}>●</span> {s.title}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Editor */}
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{activeDef.title}</div>
            <span style={{ fontSize: 10, color: "#854F0B", background: "#FAEEDA", borderRadius: 6, padding: "2px 7px" }}>slide {activeIdx + 1} of {DECK_SLIDES.length}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 12px" }}>{activeDef.help}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={() => draft(activeId)} disabled={busy} style={{ fontSize: 12, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 16, padding: "6px 13px", cursor: "pointer" }}><i className="ti ti-sparkles" aria-hidden="true" /> Write from my plan</button>
            {active.aiGenerated && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>AI draft — edit to make it yours</span>}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", background: "var(--muted)", borderRadius: 7, padding: 2 }}>
              <button onClick={() => setView("edit")} style={{ fontSize: 11, border: "none", borderRadius: 5, padding: "4px 9px", cursor: "pointer", background: view === "edit" ? INDIGO : "transparent", color: view === "edit" ? "#fff" : "var(--muted-foreground)" }}>Edit</button>
              <button onClick={() => setView("preview")} style={{ fontSize: 11, border: "none", borderRadius: 5, padding: "4px 9px", cursor: "pointer", background: view === "preview" ? INDIGO : "transparent", color: view === "preview" ? "#fff" : "var(--muted-foreground)" }}>Preview</button>
            </div>
          </div>

          {view === "edit" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Headline</label>
                <input value={active.headline} onChange={(e) => setSlide(activeId, { headline: e.target.value })} style={{ ...inp, margin: "4px 0 10px" }} />
                <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Body / bullets</label>
                <textarea value={active.body} onChange={(e) => setSlide(activeId, { body: e.target.value })} style={{ ...inp, minHeight: 160, marginTop: 4, lineHeight: 1.55, resize: "vertical" }} />
              </div>
              <SlidePreview headline={active.headline} body={active.body} eyebrow={activeDef.title} chart={activeDef.chart} data={chartData} />
            </div>
          ) : (
            <SlidePreview headline={active.headline} body={active.body} eyebrow={activeDef.title} chart={activeDef.chart} data={chartData} big />
          )}
          {activeDef.chart && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8 }}><i className="ti ti-sparkles" aria-hidden="true" /> This slide auto-draws a chart from your business plan{activeDef.chart === "projections" ? " projections" : activeDef.chart === "market" ? " market size" : " use of funds"}. Edit those numbers on the Business plan page.</div>}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid #eef1f5" }}>
            <button onClick={() => setActiveId(DECK_SLIDES[Math.max(0, activeIdx - 1)].id)} disabled={activeIdx === 0} style={btn}><i className="ti ti-arrow-left" aria-hidden="true" /> Prev</button>
            <button onClick={() => save()} disabled={busy} style={{ ...btn, color: "#0F6E56" }}><i className="ti ti-device-floppy" aria-hidden="true" /> Save</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setActiveId(DECK_SLIDES[Math.min(DECK_SLIDES.length - 1, activeIdx + 1)].id)} disabled={activeIdx === DECK_SLIDES.length - 1} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: INDIGO, border: "none", borderRadius: 8, padding: "7px 15px", cursor: "pointer" }}>Next <i className="ti ti-arrow-right" aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlidePreview({ headline, body, eyebrow, big, chart, data }: { headline: string; body: string; eyebrow: string; big?: boolean; chart?: "projections" | "market" | "funds"; data?: ChartData | null }) {
  const bullets = body.split("\n").map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean);
  const hasChart = chart && data && (chart === "projections" ? data.projections.length > 0 : chart === "market" ? (data.market.tam || data.market.sam || data.market.som) : data.allocation.length > 0);
  return (
    <div>
      {!big && <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Live preview</label>}
      <div style={{ marginTop: 4, aspectRatio: "16 / 9", background: NAVY, borderRadius: 8, padding: big ? 32 : 18, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: big ? 640 : undefined }}>
        <div style={{ fontSize: big ? 11 : 9, opacity: 0.7, letterSpacing: ".08em", textTransform: "uppercase" }}>{eyebrow}</div>
        <div style={{ fontSize: big ? 24 : 15, fontWeight: 600, margin: "4px 0 8px", lineHeight: 1.25 }}>{headline || eyebrow}</div>
        {hasChart ? (
          <div style={{ display: "flex", gap: big ? 20 : 10, alignItems: "center" }}>
            <div style={{ flex: 1, fontSize: big ? 12 : 8.5, opacity: 0.9, lineHeight: 1.5 }}>{bullets.slice(0, 4).map((b, i) => <div key={i}>• {b}</div>)}</div>
            <div style={{ flex: 1 }}><DeckChart chart={chart!} data={data!} big={!!big} /></div>
          </div>
        ) : (
          <div style={{ fontSize: big ? 13 : 9.5, opacity: 0.9, lineHeight: 1.5 }}>{bullets.slice(0, 5).map((b, i) => <div key={i}>• {b}</div>)}</div>
        )}
      </div>
    </div>
  );
}

function DeckChart({ chart, data, big }: { chart: "projections" | "market" | "funds"; data: ChartData; big: boolean }) {
  if (chart === "projections") {
    const yrs = data.projections;
    const max = Math.max(...yrs.flatMap((y) => [y.revenue, y.grossProfit]), 1);
    const W = 200, H = big ? 130 : 96, base = H - 16;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Projections">
        {yrs.map((y, i) => {
          const gx = 20 + i * ((W - 30) / yrs.length) + ((W - 30) / yrs.length) / 2;
          const rh = (y.revenue / max) * (base - 6), gh = (y.grossProfit / max) * (base - 6);
          return (<g key={i}>
            <rect x={gx - 15} y={base - rh} width={13} height={rh} rx={2} fill="#85B7EB" />
            <rect x={gx + 2} y={base - gh} width={13} height={gh} rx={2} fill="#5DCAA5" />
            <text x={gx} y={H - 3} fontSize={7.5} fill="#9fb2d6" textAnchor="middle">Y{i + 1}</text>
          </g>);
        })}
      </svg>
    );
  }
  if (chart === "market") {
    const rows = [["TAM", data.market.tam], ["SAM", data.market.sam], ["SOM", data.market.som]] as const;
    const max = Math.max(...rows.map(([, v]) => v ?? 0), 1);
    return (
      <svg viewBox="0 0 200 96" width="100%" role="img" aria-label="Market size">
        {rows.map(([label, v], i) => {
          const y = 6 + i * 28, w = ((v ?? 0) / max) * 120;
          return (<g key={label}>
            <text x={0} y={y + 11} fontSize={8} fill="#9fb2d6">{label}</text>
            <rect x={30} y={y} width={Math.max(w, 2)} height={15} rx={2} fill={CHART_HEX[i]} />
            <text x={30 + Math.max(w, 2) + 4} y={y + 11} fontSize={7.5} fill="#dce6f5">{v != null ? chMoney(v) : "—"}</text>
          </g>);
        })}
      </svg>
    );
  }
  const total = data.allocation.reduce((a, s) => a + (s.pct || 0), 0) || 1;
  const fracs = data.allocation.map((s) => (s.pct || 0) / total);
  const r = 30, cx = 34, cy = 34, sw = 13, circ = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <svg viewBox="0 0 68 68" width={big ? 80 : 60} role="img" aria-label="Use of funds">
        {fracs.map((frac, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={CHART_HEX[i % CHART_HEX.length]} strokeWidth={sw} strokeDasharray={`${frac * circ} ${circ - frac * circ}`} strokeDashoffset={-fracs.slice(0, i).reduce((a, b) => a + b, 0) * circ} transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
      </svg>
      <div style={{ fontSize: big ? 9 : 7.5, opacity: 0.9, lineHeight: 1.5 }}>{data.allocation.slice(0, 4).map((a, i) => <div key={i}><span style={{ color: CHART_HEX[i % CHART_HEX.length] }}>■</span> {a.label} {a.pct}%</div>)}</div>
    </div>
  );
}
