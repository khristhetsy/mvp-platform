"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DECK_SLIDES, DECK_GROUPS } from "@/lib/pitch-deck/slides";
import { DECK_THEMES, getDeckTheme, type DeckTheme } from "@/lib/pitch-deck/themes";

type SlideContent = { headline: string; body: string; aiGenerated: boolean };
type Deck = { slides: Record<string, SlideContent>; theme: string; status: string; shareToken: string | null };
type ChartData = { projections: { revenue: number; grossProfit: number }[]; allocation: { label: string; pct: number }[]; market: { tam: number | null; sam: number | null; som: number | null } };

const INDIGO = "#2E78F5";
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

  async function changeTheme(themeId: string) {
    if (!deck) return;
    setDeck({ ...deck, theme: themeId });
    setBusy(true);
    try { await fetch("/api/founder/pitch-deck", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: themeId }) }); }
    finally { setBusy(false); }
  }

  async function unlock() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/founder/pitch-deck", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "draft" }) });
      if (res.ok) await load();
    } finally { setBusy(false); }
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

  async function finalize() {
    setBusy(true); setMsg(null);
    try {
      await save(true);
      const res = await fetch("/api/founder/pitch-deck/finalize", { method: "POST" });
      if (!res.ok) { setMsg("Couldn’t finalize — please try again."); return; }
      setMsg("Finalized. Deck locked — download or share below.");
      await load();
    } catch { setMsg("Couldn’t finalize — please try again."); } finally { setBusy(false); }
  }

  if (!deck) return <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</p>;

  const theme = getDeckTheme(deck.theme);
  const locked = deck.status === "finalized";
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
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => save()} disabled={busy || locked} style={{ ...btn, opacity: locked ? 0.45 : 1 }}><i className="ti ti-device-floppy" aria-hidden="true" /> Save</button>
          <a href="/api/founder/pitch-deck/pdf" style={btn}><i className="ti ti-file-type-pdf" aria-hidden="true" /> PDF</a>
          <a href="/api/founder/pitch-deck/pptx" style={btn}><i className="ti ti-presentation" aria-hidden="true" /> PPTX</a>
          <button onClick={share} disabled={busy} style={btn}><i className="ti ti-link" aria-hidden="true" /> Share link</button>
          {locked ? (
            <>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0F6E56", background: "#E1F5EE", borderRadius: 8, padding: "7px 13px" }}><i className="ti ti-lock-check" aria-hidden="true" /> Finalized</span>
              <button onClick={unlock} disabled={busy} style={btn}><i className="ti ti-lock-open" aria-hidden="true" /> Unlock to edit</button>
            </>
          ) : (
            <button onClick={finalize} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: INDIGO, border: "none", borderRadius: 8, padding: "7px 15px", cursor: "pointer" }}>Finalize</button>
          )}
        </div>
        {/* Theme picker */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Theme</span>
          {DECK_THEMES.map((t) => {
            const on = t.id === deck.theme;
            return (
              <button key={t.id} onClick={() => changeTheme(t.id)} disabled={busy || locked} title={t.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "4px 9px", borderRadius: 8, border: on ? `2px solid ${INDIGO}` : "0.5px solid var(--border-strong, #cbd5e1)", background: on ? "#F2F7FF" : "transparent", color: "var(--foreground)", cursor: locked ? "not-allowed" : "pointer", opacity: locked && !on ? 0.5 : 1 }}>
                <span style={{ width: 13, height: 13, borderRadius: 4, background: t.swatch, border: t.id === "light" ? "0.5px solid #cbd5e1" : "none" }} />{t.label}
              </button>
            );
          })}
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--muted-foreground)" }}>applies to preview, PDF &amp; PPTX</span>
        </div>
        {msg && <span style={{ fontSize: 11.5, color: msg.includes("Couldn") || msg.includes("fail") ? "#A32D2D" : "#0F6E56", width: "100%" }}>{msg}</span>}
        {shareUrl && <div style={{ width: "100%", fontSize: 11.5, color: "#185FA5" }}>Read-only link copied: <a href={shareUrl} style={{ color: "#185FA5" }}>{shareUrl}</a></div>}
      </div>

      {locked && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#E1F5EE", border: "0.5px solid #A7E0CE", borderRadius: 12, padding: "12px 16px", marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0F6E56" }}><i className="ti ti-circle-check" aria-hidden="true" /> Your deck is finalized and ready to send.</span>
          <div style={{ flex: 1 }} />
          <a href="/api/founder/pitch-deck/pdf" style={{ ...btn, background: "#fff" }}><i className="ti ti-file-type-pdf" aria-hidden="true" /> Download PDF</a>
          <a href="/api/founder/pitch-deck/pptx" style={{ ...btn, background: "#fff" }}><i className="ti ti-presentation" aria-hidden="true" /> Download PPTX</a>
          <button onClick={share} disabled={busy} style={{ ...btn, background: "#fff" }}><i className="ti ti-link" aria-hidden="true" /> Copy share link</button>
          <button onClick={unlock} disabled={busy} style={btn}><i className="ti ti-lock-open" aria-hidden="true" /> Unlock to edit</button>
        </div>
      )}

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
            <button onClick={() => draft(activeId)} disabled={busy || locked} style={{ fontSize: 12, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 16, padding: "6px 13px", cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.5 : 1 }}><i className="ti ti-sparkles" aria-hidden="true" /> Write from my plan</button>
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
                <input value={active.headline} readOnly={locked} onChange={(e) => setSlide(activeId, { headline: e.target.value })} style={{ ...inp, margin: "4px 0 10px", background: locked ? "var(--muted)" : "var(--background)" }} />
                <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Body / bullets</label>
                <textarea value={active.body} readOnly={locked} onChange={(e) => setSlide(activeId, { body: e.target.value })} style={{ ...inp, minHeight: 160, marginTop: 4, lineHeight: 1.55, resize: "vertical", background: locked ? "var(--muted)" : "var(--background)" }} />
              </div>
              <SlidePreview headline={active.headline} body={active.body} eyebrow={activeDef.title} chart={activeDef.chart} data={chartData} theme={theme} />
            </div>
          ) : (
            <SlidePreview headline={active.headline} body={active.body} eyebrow={activeDef.title} chart={activeDef.chart} data={chartData} theme={theme} big />
          )}
          {activeDef.chart && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8 }}><i className="ti ti-sparkles" aria-hidden="true" /> This slide auto-draws a chart from your business plan{activeDef.chart === "projections" ? " projections" : activeDef.chart === "market" ? " market size" : " use of funds"}. Edit those numbers on the Business plan page.</div>}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid #eef1f5" }}>
            <button onClick={() => setActiveId(DECK_SLIDES[Math.max(0, activeIdx - 1)].id)} disabled={activeIdx === 0} style={btn}><i className="ti ti-arrow-left" aria-hidden="true" /> Prev</button>
            <button onClick={() => save()} disabled={busy || locked} style={{ ...btn, color: "#0F6E56", opacity: locked ? 0.45 : 1 }}><i className="ti ti-device-floppy" aria-hidden="true" /> Save</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setActiveId(DECK_SLIDES[Math.min(DECK_SLIDES.length - 1, activeIdx + 1)].id)} disabled={activeIdx === DECK_SLIDES.length - 1} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: INDIGO, border: "none", borderRadius: 8, padding: "7px 15px", cursor: "pointer" }}>Next <i className="ti ti-arrow-right" aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlidePreview({ headline, body, eyebrow, big, chart, data, theme }: { headline: string; body: string; eyebrow: string; big?: boolean; chart?: "projections" | "market" | "funds"; data?: ChartData | null; theme: DeckTheme }) {
  const bullets = body.split("\n").map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean);
  const hasChart = chart && data && (chart === "projections" ? data.projections.length > 0 : chart === "market" ? (data.market.tam || data.market.sam || data.market.som) : data.allocation.length > 0);
  return (
    <div>
      {!big && <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Live preview</label>}
      <div style={{ marginTop: 4, aspectRatio: "16 / 9", background: theme.bg, borderRadius: 8, padding: big ? 32 : 18, color: theme.headline, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: big ? 640 : undefined, border: theme.id === "light" ? "0.5px solid #d8dde5" : "none" }}>
        <div style={{ fontSize: big ? 11 : 9, color: theme.accent, letterSpacing: ".08em", textTransform: "uppercase" }}>{eyebrow}</div>
        <div style={{ fontSize: big ? 24 : 15, fontWeight: 600, margin: "4px 0 8px", lineHeight: 1.25 }}>{headline || eyebrow}</div>
        {hasChart ? (
          <div style={{ display: "flex", gap: big ? 20 : 10, alignItems: "center" }}>
            <div style={{ flex: 1, fontSize: big ? 12 : 8.5, color: theme.body, lineHeight: 1.5 }}>{bullets.slice(0, 4).map((b, i) => <div key={i}>• {b}</div>)}</div>
            <div style={{ flex: 1 }}><DeckChart chart={chart!} data={data!} big={!!big} theme={theme} /></div>
          </div>
        ) : (
          <div style={{ fontSize: big ? 13 : 9.5, color: theme.body, lineHeight: 1.5 }}>{bullets.slice(0, 5).map((b, i) => <div key={i}>• {b}</div>)}</div>
        )}
      </div>
    </div>
  );
}

function DeckChart({ chart, data, big, theme }: { chart: "projections" | "market" | "funds"; data: ChartData; big: boolean; theme: DeckTheme }) {
  const CH = theme.chart;
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
            <rect x={gx - 15} y={base - rh} width={13} height={rh} rx={2} fill={CH[0]} />
            <rect x={gx + 2} y={base - gh} width={13} height={gh} rx={2} fill={CH[1]} />
            <text x={gx} y={H - 3} fontSize={7.5} fill={theme.footer} textAnchor="middle">Y{i + 1}</text>
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
            <text x={0} y={y + 11} fontSize={8} fill={theme.footer}>{label}</text>
            <rect x={30} y={y} width={Math.max(w, 2)} height={15} rx={2} fill={CH[i]} />
            <text x={30 + Math.max(w, 2) + 4} y={y + 11} fontSize={7.5} fill={theme.body}>{v != null ? chMoney(v) : "—"}</text>
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
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={CH[i % CH.length]} strokeWidth={sw} strokeDasharray={`${frac * circ} ${circ - frac * circ}`} strokeDashoffset={-fracs.slice(0, i).reduce((a, b) => a + b, 0) * circ} transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
      </svg>
      <div style={{ fontSize: big ? 9 : 7.5, color: theme.body, lineHeight: 1.5 }}>{data.allocation.slice(0, 4).map((a, i) => <div key={i}><span style={{ color: CH[i % CH.length] }}>■</span> {a.label} {a.pct}%</div>)}</div>
    </div>
  );
}
