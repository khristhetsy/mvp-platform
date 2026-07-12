"use client";

// Partner Scores with view options: cards / table / compact, plus sort and a type
// filter. Same live scores — just different densities for scanning many partners.
// The chosen view/sort/filter persist in localStorage.
import { useEffect, useMemo, useState } from "react";
import { PartnerScoreCard } from "@/components/admin/PartnerScoreCard";
import { TIER_LABELS, type PartnerScore, type PartnerTier } from "@/lib/investor-rating/types";

export interface PartnerItem { name: string; subtitle: string; type: string; rating: PartnerScore }
type View = "cards" | "table" | "compact";
type Sort = "score" | "engaged" | "name";

const NAVY = "#0A1A40", MUTED = "var(--muted-foreground)", ACCENT = "#4338CA";
const LS_KEY = "icapos.partnerScores.view";

function scoreVal(r: PartnerScore): number { return r.score ?? -1; }
function pct(n: number): string { return `${Math.round(n * 100)}%`; }

export function PartnerScoresView({ items }: { items: PartnerItem[] }) {
  const [prefs, setPrefs] = useState<{ view: View; sort: Sort; typeFilter: string }>({ view: "cards", sort: "score", typeFilter: "all" });
  const { view, sort, typeFilter } = prefs;
  const setView = (view: View) => setPrefs((p) => ({ ...p, view }));
  const setSort = (sort: Sort) => setPrefs((p) => ({ ...p, sort }));
  const setTypeFilter = (typeFilter: string) => setPrefs((p) => ({ ...p, typeFilter }));

  // Load persisted prefs after mount (defaults render first, avoiding hydration mismatch).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
      if (saved.view || saved.sort || saved.typeFilter) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefs((p) => ({ view: saved.view ?? p.view, sort: saved.sort ?? p.sort, typeFilter: saved.typeFilter ?? p.typeFilter }));
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

  const types = useMemo(() => Array.from(new Set(items.map((i) => i.type).filter(Boolean))), [items]);
  const shown = useMemo(() => {
    const filtered = typeFilter === "all" ? items : items.filter((i) => i.type === typeFilter);
    const sorted = filtered.slice().sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "engaged") return b.rating.sampleSize - a.rating.sampleSize;
      return scoreVal(b.rating) - scoreVal(a.rating);
    });
    return sorted;
  }, [items, typeFilter, sort]);

  const seg = (v: View, icon: string, label: string) => (
    <button onClick={() => setView(v)} style={{ fontSize: 12, padding: "6px 12px", background: view === v ? ACCENT : "transparent", color: view === v ? "#fff" : MUTED, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <i className={`ti ${icon}`} aria-hidden="true" /> {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          {seg("cards", "ti-layout-grid", "Cards")}{seg("table", "ti-list", "Table")}{seg("compact", "ti-layout-rows", "Compact")}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6 }}>Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "0.5px solid var(--border)" }}>
              <option value="score">Score</option><option value="engaged">Engaged</option><option value="name">Name</option>
            </select>
          </label>
          {types.length > 1 && (
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "0.5px solid var(--border)" }}>
              <option value="all">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: 24, fontSize: 13, color: MUTED, textAlign: "center", border: "0.5px dashed var(--border)", borderRadius: 12 }}>No partners match this filter.</div>
      ) : view === "cards" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {shown.map((r) => <PartnerScoreCard key={r.name + r.subtitle} name={r.name} subtitle={r.subtitle} rating={r.rating} />)}
        </div>
      ) : view === "table" ? (
        <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 0.7fr 0.8fr 0.8fr", padding: "9px 14px", background: "#F6F8FB", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: MUTED }}>
            <div>Partner</div><div>Type</div><div>Tier</div><div>Score</div><div>Engaged</div><div>Reply</div>
          </div>
          {shown.map((r) => (
            <div key={r.name + r.subtitle} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 0.7fr 0.8fr 0.8fr", padding: "10px 14px", borderTop: "0.5px solid #F1F4F9", fontSize: 12.5, alignItems: "center" }}>
              <div style={{ fontWeight: 600, color: NAVY }}>{r.name}</div>
              <div style={{ color: MUTED }}>{r.type || "—"}</div>
              <div>{TIER_LABELS[r.rating.tier as PartnerTier] ?? r.rating.tier}</div>
              <div style={{ fontWeight: 600, color: NAVY }}>{r.rating.score ?? "—"}</div>
              <div>{r.rating.sampleSize}</div>
              <div>{pct(r.rating.facts.replyRate)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {shown.map((r) => {
            const s = r.rating.score ?? 0;
            return (
              <div key={r.name + r.subtitle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderTop: "0.5px solid #F1F4F9" }}>
                <span style={{ flex: "0 0 200px", fontSize: 12.5, fontWeight: 600, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                <div style={{ flex: 1, height: 8, background: "#F1EFE8", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(0, s)}%`, background: ACCENT, borderRadius: 99 }} />
                </div>
                <span style={{ flex: "0 0 auto", fontSize: 12.5, fontWeight: 600, color: NAVY, width: 30, textAlign: "right" }}>{r.rating.score ?? "—"}</span>
                <span style={{ flex: "0 0 auto", fontSize: 11.5, color: MUTED, width: 74, textAlign: "right" }}>{r.rating.sampleSize} engaged</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
