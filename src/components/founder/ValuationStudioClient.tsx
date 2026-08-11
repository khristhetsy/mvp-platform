"use client";

import { useMemo, useRef, useState } from "react";
import {
  computeMethods,
  convergedRange,
  money,
  SCORECARD_WEIGHTS,
  type ValuationInputs,
  type Stage,
} from "@/lib/valuation/methods";
import { VALUATION_DISCLAIMER, MODELED_ESTIMATES_LINE, SAMPLE_BADGE } from "@/lib/valuation/compliance";

/* Brand — the Valuation Studio is a self-contained dark surface (spec/mockup). */
const C = {
  navy: "#0A1A40", panel: "#0D2050", panelEdge: "#16306B",
  blue: "#1A6CE4", hover: "#2E78F5", steel: "#185FA5", ice: "#4F94FF",
  text: "#E8EEFB", mute: "#8FA6D4",
};
const mono = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const display = "'Archivo', 'Helvetica Neue', Arial, sans-serif";

/** The numeric scalar inputs that can be pre-filled from the company profile. */
type LoadableField =
  | "raiseAmount" | "arr" | "growthRate" | "ownershipLow" | "ownershipHigh"
  | "assetBase" | "exitRevenue" | "exitMultiple" | "compLow" | "compHigh"
  | "regionalBase" | "berkusCap";

export type ValuationProfile = {
  company: string;
  sector: string;
  stage: Stage;
  staleDays: number;
  updatedLabel: string;
  fields: Partial<Record<LoadableField, number>>;
  missing: string[];
};

type Lever = {
  title: string; diagnosis: string; action: string; methods: string[];
  upliftLow: number; upliftHigh: number; effort: "Low" | "Medium" | "High"; timeframe: string;
};
type Advice = { read: string; spread: string; caution: string; levers: Lever[]; isSample?: boolean };

const STAGES: { id: Stage; label: string; note: string }[] = [
  { id: "preseed", label: "Pre-seed", note: "No revenue. Angel logic." },
  { id: "seed", label: "Seed / Series A", note: "Early revenue. VC logic." },
  { id: "revenue", label: "Revenue stage", note: "Scaled. Banker logic." },
];
const STAGE_LABEL: Record<Stage, string> = { preseed: "Pre-seed", seed: "Seed / Series A", revenue: "Revenue stage" };

const BERKUS_ITEMS: [string, string][] = [
  ["Sound idea", "Basic value, de-risked concept"],
  ["Prototype", "Reduces technology risk"],
  ["Quality management team", "Reduces execution risk"],
  ["Strategic relationships", "Reduces market risk"],
  ["Product rollout / sales", "Reduces production risk"],
];
const SCORECARD_FACTORS: string[] = [
  "Strength of team", "Size of opportunity", "Product / technology",
  "Competitive environment", "Marketing, sales, partnerships", "Need for further investment", "Other factors",
];
const RFS_FACTORS: string[] = [
  "Management", "Stage of business", "Legislation / political", "Manufacturing", "Sales & marketing",
  "Funding / capital", "Competition", "Technology", "Litigation", "International", "Reputation", "Exit potential",
];

const FIELD_LABELS: Record<string, string> = {
  arr: "Current ARR", growthRate: "Revenue growth rate", raiseAmount: "Amount raising",
  ownershipLow: "Target ownership (low)", ownershipHigh: "Target ownership (high)", assetBase: "Asset and IP base",
  exitRevenue: "Revenue at exit", exitMultiple: "Exit multiple",
  compLow: "Comparable multiple (low)", compHigh: "Comparable multiple (high)",
};

const DEFAULT_INPUTS: ValuationInputs = {
  company: "", sector: "B2B SaaS",
  berkusCap: 500_000, berkus: [60, 50, 70, 40, 30], regionalBase: 2_500_000,
  scorecard: [100, 100, 100, 100, 100, 100, 100], rfs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  raiseAmount: 2_000_000, ownershipLow: 15, ownershipHigh: 25,
  exitRevenue: 40_000_000, exitMultiple: 5, targetROILow: 10, targetROIHigh: 25, futureDilution: 30,
  arr: 1_200_000, growthRate: 60, compLow: 5, compHigh: 9, illiquidityDiscount: 25, controlPremium: 25,
  fcfMargin: 15, discountRate: 25, terminalGrowth: 3, assetBase: 0,
};

type Provenance = "profile" | "manual";

/* ---------------------------- small UI ---------------------------- */

function SourceChip({ src }: { src: Provenance | null }) {
  if (!src) return null;
  const fromProfile = src === "profile";
  return (
    <span style={{
      fontFamily: mono, fontSize: 9, letterSpacing: "0.06em", marginLeft: 8, padding: "1px 6px", borderRadius: 4,
      color: fromProfile ? C.navy : C.mute, background: fromProfile ? C.ice : "transparent",
      border: fromProfile ? "none" : `1px solid ${C.panelEdge}`,
    }}>
      {fromProfile ? "FROM PROFILE" : "ENTERED"}
    </span>
  );
}

function Slider({ label, sub, value, min, max, step, onChange, format, src }: {
  label: string; sub?: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string; src?: Provenance | null;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <label style={{ fontSize: 14, color: C.text }}>{label}<SourceChip src={src ?? null} /></label>
        <span style={{ fontFamily: mono, color: C.ice, fontSize: 12 }}>{format ? format(value) : value}</span>
      </div>
      {sub && <div style={{ fontSize: 12, marginTop: 2, color: C.mute }}>{sub}</div>}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", marginTop: 8, accentColor: C.blue, cursor: "pointer" }} />
    </div>
  );
}

function NumField({ label, value, onChange, prefix, suffix, step = 1, src }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; step?: number; src?: Provenance | null;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 14, display: "block", marginBottom: 6, color: C.text }}>{label}<SourceChip src={src ?? null} /></label>
      <div style={{ display: "flex", alignItems: "center", borderRadius: 6, overflow: "hidden", background: C.navy, border: `1px solid ${C.panelEdge}` }}>
        {prefix && <span style={{ paddingLeft: 12, fontSize: 14, color: C.mute, fontFamily: mono }}>{prefix}</span>}
        <input type="number" value={value} step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{ width: "100%", background: "transparent", padding: "8px 12px", fontSize: 14, color: C.text, fontFamily: mono, border: "none", outline: "none" }} />
        {suffix && <span style={{ paddingRight: 12, fontSize: 14, color: C.mute, fontFamily: mono }}>{suffix}</span>}
      </div>
    </div>
  );
}

function Panel({ title, eyebrow, children }: { title?: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section style={{ borderRadius: 8, padding: 20, marginBottom: 20, background: C.panel, border: `1px solid ${C.panelEdge}` }}>
      {eyebrow && <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", color: C.steel, marginBottom: 4 }}>{eyebrow.toUpperCase()}</div>}
      {title && <h2 style={{ fontFamily: display, fontSize: 19, fontWeight: 700, color: C.text, marginBottom: 16 }}>{title}</h2>}
      {children}
    </section>
  );
}

function FootballField({ methods, converged }: { methods: ReturnType<typeof computeMethods>; converged: { low: number; high: number } }) {
  if (!methods.length) return null;
  const min = Math.min(...methods.map((m) => m.low));
  const max = Math.max(...methods.map((m) => m.high));
  const pad = (max - min) * 0.12 || max * 0.2 || 1;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;
  const span = hi - lo || 1;
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / span) * 100));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * span);
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", top: 0, bottom: 32, pointerEvents: "none", borderRadius: 4,
        left: `${pct(converged.low)}%`, width: `${Math.max(0.6, pct(converged.high) - pct(converged.low))}%`,
        background: "rgba(79,148,255,0.13)", borderLeft: `1px dashed ${C.ice}`, borderRight: `1px dashed ${C.ice}`,
      }} />
      {methods.map((m) => (
        <div key={m.code} style={{ marginBottom: 12, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: C.ice, letterSpacing: "0.1em" }}>{m.code}</span>
            <span style={{ fontSize: 12, color: C.text }}>{m.name}</span>
            <span style={{ fontSize: 12, marginLeft: "auto", fontFamily: mono, color: C.mute }}>{money(m.low)} – {money(m.high)}</span>
          </div>
          <div style={{ height: 12, borderRadius: 3, position: "relative", background: "rgba(255,255,255,0.05)" }}>
            <div style={{ position: "absolute", height: 12, borderRadius: 3, left: `${pct(m.low)}%`, width: `${Math.max(1.2, pct(m.high) - pct(m.low))}%`, background: `linear-gradient(90deg, ${C.steel}, ${C.hover})` }} />
          </div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${C.panelEdge}` }}>
        {ticks.map((t, i) => <span key={i} style={{ fontFamily: mono, fontSize: 10, color: C.mute }}>{money(t)}</span>)}
      </div>
    </div>
  );
}

/* ------------------------------ app ------------------------------- */

export function ValuationStudioClient({ profile }: { profile: ValuationProfile | null }) {
  const [screen, setScreen] = useState<"intake" | "studio">("intake");
  const [stage, setStage] = useState<Stage>(profile?.stage ?? "seed");
  const [inp, setInp] = useState<ValuationInputs>(DEFAULT_INPUTS);
  const [source, setSource] = useState<"profile" | "manual">("manual");
  const [sourced, setSourced] = useState<Record<string, Provenance>>({});
  const [staleAck, setStaleAck] = useState(false);

  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const set = (k: keyof ValuationInputs) => (v: number) => {
    setSourced((s) => (s[k] ? { ...s, [k]: "manual" } : s));
    setInp((p) => ({ ...p, [k]: v }));
  };
  const setArr = (k: "berkus" | "scorecard" | "rfs", i: number) => (v: number) =>
    setInp((p) => { const a = [...p[k]]; a[i] = v; return { ...p, [k]: a }; });
  const srcOf = (k: keyof ValuationInputs): Provenance | null => (source === "profile" ? sourced[k] ?? "manual" : null);

  const methods = useMemo(() => computeMethods(stage, inp), [stage, inp]);
  const converged = useMemo(() => convergedRange(methods), [methods]);

  function continueWithProfile() {
    if (!profile) return;
    setInp((p) => ({ ...p, ...profile.fields, sector: profile.sector }));
    const marks: Record<string, Provenance> = {};
    Object.keys(profile.fields).forEach((k) => (marks[k] = "profile"));
    setSourced(marks);
    setStage(profile.stage);
    setSource("profile");
    setScreen("studio");
  }
  function startBlank() {
    setSourced({});
    setSource("manual");
    setScreen("studio");
  }

  async function runAdvisor(sample: boolean) {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/valuations/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sample,
          stage: STAGE_LABEL[stage],
          sector: inp.sector,
          convergedRange: [Math.round(converged.low), Math.round(converged.high)],
          methods: methods.map((m) => ({ method: m.name, low: Math.round(m.low), high: Math.round(m.high), basis: m.basis })),
          drivers: {
            arr: inp.arr, growthRatePct: inp.growthRate, raise: inp.raiseAmount,
            targetOwnershipPct: [inp.ownershipLow, inp.ownershipHigh],
            exitRevenue: inp.exitRevenue, exitMultiple: inp.exitMultiple,
            revenueMultipleRange: [inp.compLow, inp.compHigh], fcfMarginPct: inp.fcfMargin,
          },
          provenance: sourced,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { advice?: Advice; isSample?: boolean; error?: string };
      if (!res.ok || !data.advice) { setErr(data.error ?? "The advisor could not read that result. Adjust an input and run it again."); return; }
      setAdvice({ ...data.advice, isSample: data.isSample });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch {
      setErr("The advisor is unavailable right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  const effortColor = (e: string) => (e === "Low" ? "#3FBF7F" : e === "High" ? "#E0674A" : C.ice);
  const stale = (profile?.staleDays ?? 0) > 60;

  const shell = (children: React.ReactNode) => (
    <div style={{ background: C.navy, color: C.text, borderRadius: 16, padding: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {children}
      <footer style={{ marginTop: 20, paddingTop: 16, fontSize: 12, borderTop: `1px solid ${C.panelEdge}`, color: C.mute }}>
        {VALUATION_DISCLAIMER}
      </footer>
    </div>
  );

  /* ---------------------------- intake ---------------------------- */
  if (screen === "intake") {
    return shell(
      <div>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", color: C.steel }}>STEP ONE</div>
        <h2 style={{ fontFamily: display, fontWeight: 700, fontSize: 22, margin: "6px 0 8px" }}>Where should the numbers come from?</h2>
        <p style={{ fontSize: 14, marginBottom: 20, maxWidth: 560, color: C.mute }}>
          Pull what iCapOS already holds on your company, or build a valuation from scratch for a company that isn&apos;t on the platform yet.
        </p>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <button type="button" onClick={continueWithProfile} disabled={!profile}
            style={{ textAlign: "left", borderRadius: 8, padding: 20, background: C.panel, border: `1px solid ${C.panelEdge}`, cursor: profile ? "pointer" : "not-allowed", opacity: profile ? 1 : 0.55, color: C.text }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", color: C.ice }}>USE EXISTING DATA</div>
            <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 17, margin: "8px 0" }}>Pull from my company profile</h3>
            <p style={{ fontSize: 14, marginBottom: 12, color: C.mute }}>
              {profile ? "Fills what you entered during onboarding. Everything stays editable, and anything missing is flagged before you run it."
                : "This account has no company profile — use the blank path instead."}
            </p>
          </button>
          <button type="button" onClick={startBlank}
            style={{ textAlign: "left", borderRadius: 8, padding: 20, background: C.panel, border: `1px solid ${C.panelEdge}`, cursor: "pointer", color: C.text }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", color: C.steel }}>START CLEAN</div>
            <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 17, margin: "8px 0" }}>Build a new valuation</h3>
            <p style={{ fontSize: 14, marginBottom: 12, color: C.mute }}>
              Enter everything by hand. Use this for a company you&apos;re evaluating, a Deal Company, or a scenario you don&apos;t want written back to your profile.
            </p>
          </button>
        </div>

        {profile && (
          <div style={{ marginTop: 20, borderRadius: 8, padding: 20, background: C.panel, border: `1px solid ${C.panelEdge}` }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", color: C.steel }}>FOUND ON YOUR PROFILE</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 16px", flexWrap: "wrap" }}>
              <span style={{ fontFamily: display, fontWeight: 700, fontSize: 18 }}>{profile.company}</span>
              <span style={{ fontSize: 12, color: C.mute }}>{profile.sector} · updated {profile.updatedLabel}</span>
            </div>
            {profile.missing.length > 0 && (
              <div style={{ borderRadius: 6, padding: "10px 14px", fontSize: 13, background: "rgba(79,148,255,0.1)", border: `1px solid ${C.steel}` }}>
                <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", color: C.ice }}>YOU&apos;LL NEED TO ADD — </span>
                <span style={{ color: C.text }}>{profile.missing.map((m) => FIELD_LABELS[m] || m).join(", ")}. These aren&apos;t collected during onboarding.</span>
              </div>
            )}
            {stale && (
              <div style={{ marginTop: 12, borderRadius: 6, padding: "10px 14px", fontSize: 13, background: "rgba(224,103,74,0.12)", color: "#F0A08A", border: "1px solid rgba(224,103,74,0.3)" }}>
                <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em" }}>STALE DATA — </span>
                Your profile financials are {profile.staleDays} days old. Re-confirm ARR and growth on the next screen before you rely on this range.
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: C.text }}>
                  <input type="checkbox" checked={staleAck} onChange={(e) => setStaleAck(e.target.checked)} />
                  I&apos;ll re-confirm ARR and growth
                </label>
              </div>
            )}
            <button type="button" onClick={continueWithProfile} disabled={stale && !staleAck}
              style={{ marginTop: 16, borderRadius: 6, padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff", background: C.blue, border: "none", cursor: stale && !staleAck ? "not-allowed" : "pointer", opacity: stale && !staleAck ? 0.5 : 1 }}>
              Continue with this data
            </button>
          </div>
        )}
      </div>,
    );
  }

  /* ---------------------------- studio ---------------------------- */
  return shell(
    <div>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 17 }}>{inp.company || profile?.company || "Untitled valuation"}</span>
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 4,
            color: source === "profile" ? C.navy : C.mute, background: source === "profile" ? C.ice : "transparent", border: source === "profile" ? "none" : `1px solid ${C.panelEdge}` }}>
            {source === "profile" ? "FROM COMPANY PROFILE" : "MANUAL ENTRY"}
          </span>
          <button type="button" onClick={() => setScreen("intake")} style={{ fontSize: 12, color: C.ice, textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Change data source</button>
        </div>
      </header>

      {/* stage router */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        {STAGES.map((s) => {
          const on = s.id === stage;
          return (
            <button type="button" key={s.id} onClick={() => setStage(s.id)}
              style={{ textAlign: "left", borderRadius: 6, padding: "12px 16px", minWidth: 170, cursor: "pointer",
                background: on ? C.blue : C.panel, border: `1px solid ${on ? C.hover : C.panelEdge}`, color: C.text }}>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: 15 }}>{s.label}</div>
              <div style={{ fontSize: 12, marginTop: 2, color: on ? "rgba(255,255,255,0.8)" : C.mute }}>{s.note}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)" }}>
        {/* inputs */}
        <div>
          {stage === "preseed" && (
            <>
              <Panel eyebrow="BRK" title="Berkus milestones">
                {BERKUS_ITEMS.map(([n, sub], i) => (
                  <Slider key={n} label={n} sub={sub} value={inp.berkus[i]} min={0} max={100} step={5}
                    onChange={setArr("berkus", i)} format={(v) => money((v / 100) * inp.berkusCap)} />
                ))}
                <NumField label="Value cap per milestone" prefix="$" value={inp.berkusCap} onChange={set("berkusCap")} step={50000} />
              </Panel>
              <Panel eyebrow="SCR" title="Scorecard factors">
                {SCORECARD_FACTORS.map((n, i) => (
                  <Slider key={n} label={n} sub={`${Math.round(SCORECARD_WEIGHTS[i] * 100)}% of the score`}
                    value={inp.scorecard[i]} min={50} max={150} step={5} onChange={setArr("scorecard", i)} format={(v) => `${v}%`} />
                ))}
              </Panel>
              <Panel eyebrow="RFS" title="Risk factors">
                <div style={{ fontSize: 12, marginBottom: 16, color: C.mute }}>−2 is very risky, +2 is a clear advantage. Each step moves $250K.</div>
                {RFS_FACTORS.map((n, i) => (
                  <Slider key={n} label={n} value={inp.rfs[i]} min={-2} max={2} step={1} onChange={setArr("rfs", i)} format={(v) => (v > 0 ? `+${v}` : `${v}`)} />
                ))}
              </Panel>
            </>
          )}
          {stage === "seed" && (
            <Panel eyebrow="SCR" title="Scorecard factors">
              {SCORECARD_FACTORS.map((n, i) => (
                <Slider key={n} label={n} sub={`${Math.round(SCORECARD_WEIGHTS[i] * 100)}% of the score`}
                  value={inp.scorecard[i]} min={50} max={150} step={5} onChange={setArr("scorecard", i)} format={(v) => `${v}%`} />
              ))}
            </Panel>
          )}

          <Panel eyebrow="Inputs" title="The round">
            <NumField label="Amount you are raising" prefix="$" value={inp.raiseAmount} onChange={set("raiseAmount")} step={100000} src={srcOf("raiseAmount")} />
            {stage !== "revenue" && (
              <>
                <Slider label="Ownership the lead expects — low" value={inp.ownershipLow} min={5} max={40} step={1} onChange={set("ownershipLow")} format={(v) => `${v}%`} src={srcOf("ownershipLow")} />
                <Slider label="Ownership the lead expects — high" value={inp.ownershipHigh} min={5} max={40} step={1} onChange={set("ownershipHigh")} format={(v) => `${v}%`} src={srcOf("ownershipHigh")} />
              </>
            )}
            {(stage === "preseed" || stage === "seed") && (
              <NumField label="Regional base pre-money for your market" prefix="$" value={inp.regionalBase} onChange={set("regionalBase")} step={250000} />
            )}
          </Panel>

          {(stage === "seed" || stage === "revenue") && (
            <Panel eyebrow="VCM" title="Exit assumptions">
              <NumField label="Revenue at exit" prefix="$" value={inp.exitRevenue} onChange={set("exitRevenue")} step={1000000} src={srcOf("exitRevenue")} />
              <Slider label="Exit revenue multiple" value={inp.exitMultiple} min={1} max={15} step={0.5} onChange={set("exitMultiple")} format={(v) => `${v}×`} src={srcOf("exitMultiple")} />
              <Slider label="Investor target return — low" value={inp.targetROILow} min={3} max={40} step={1} onChange={set("targetROILow")} format={(v) => `${v}×`} />
              <Slider label="Investor target return — high" value={inp.targetROIHigh} min={3} max={60} step={1} onChange={set("targetROIHigh")} format={(v) => `${v}×`} />
              <Slider label="Dilution before exit" value={inp.futureDilution} min={0} max={70} step={5} onChange={set("futureDilution")} format={(v) => `${v}%`} />
            </Panel>
          )}

          {(stage === "seed" || stage === "revenue") && (
            <Panel eyebrow="TCM" title="Trading and transaction comps">
              <NumField label="Current ARR" prefix="$" value={inp.arr} onChange={set("arr")} step={100000} src={srcOf("arr")} />
              <Slider label="Comparable multiple — low" value={inp.compLow} min={0.5} max={20} step={0.5} onChange={set("compLow")} format={(v) => `${v}×`} src={srcOf("compLow")} />
              <Slider label="Comparable multiple — high" value={inp.compHigh} min={0.5} max={30} step={0.5} onChange={set("compHigh")} format={(v) => `${v}×`} src={srcOf("compHigh")} />
              <Slider label="Private company discount" value={inp.illiquidityDiscount} min={0} max={50} step={5} onChange={set("illiquidityDiscount")} format={(v) => `${v}%`} />
              {stage === "revenue" && (
                <Slider label="Control premium" value={inp.controlPremium} min={0} max={50} step={5} onChange={set("controlPremium")} format={(v) => `${v}%`} />
              )}
            </Panel>
          )}

          {stage === "revenue" && (
            <Panel eyebrow="DCF" title="Cash flow model">
              <Slider label="Revenue growth rate" value={inp.growthRate} min={0} max={200} step={5} onChange={set("growthRate")} format={(v) => `${v}%`} src={srcOf("growthRate")} />
              <Slider label="Free cash flow margin" value={inp.fcfMargin} min={-20} max={50} step={1} onChange={set("fcfMargin")} format={(v) => `${v}%`} />
              <Slider label="Discount rate" value={inp.discountRate} min={8} max={45} step={1} onChange={set("discountRate")} format={(v) => `${v}%`} />
              <Slider label="Terminal growth" value={inp.terminalGrowth} min={0} max={6} step={0.5} onChange={set("terminalGrowth")} format={(v) => `${v}%`} />
            </Panel>
          )}

          <Panel eyebrow="AST" title="Downside floor">
            <div style={{ fontSize: 12, marginBottom: 12, color: C.mute }}>What a family office would recover: hard assets, IP, and contracted backlog. Leave at zero to skip.</div>
            <NumField label="Recoverable asset and IP base" prefix="$" value={inp.assetBase} onChange={set("assetBase")} step={100000} src={srcOf("assetBase")} />
          </Panel>
        </div>

        {/* results */}
        <div>
          <Panel eyebrow="Converged range" title="Where the methods land">
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontFamily: display, fontWeight: 800, fontSize: 34, color: C.ice }}>{money(converged.low)}</span>
              <span style={{ color: C.mute, fontSize: 20 }}>–</span>
              <span style={{ fontFamily: display, fontWeight: 800, fontSize: 34, color: C.ice }}>{money(converged.high)}</span>
              <span style={{ fontSize: 12, color: C.mute }}>pre-money</span>
            </div>
            <div style={{ fontSize: 12, marginBottom: 24, color: C.mute }}>
              Median across {methods.length} method{methods.length === 1 ? "" : "s"} for this stage. Carry the range into the room, not a single number.
            </div>
            <FootballField methods={methods} converged={converged} />
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {methods.map((m) => (
                <div key={m.code} style={{ fontSize: 12, display: "flex", gap: 12 }}>
                  <span style={{ fontFamily: mono, color: C.steel, minWidth: 32 }}>{m.code}</span>
                  <span style={{ color: C.mute }}>{m.basis}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Advisor" title="How to move this number">
            <p style={{ fontSize: 14, marginBottom: 16, color: C.mute }}>
              The advisor reads your inputs and the spread between methods, then returns the five changes with the most valuation impact per unit of effort.
            </p>
            <button type="button" onClick={() => runAdvisor(false)} disabled={loading || !methods.length}
              style={{ borderRadius: 6, padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff", background: loading ? C.steel : C.blue, border: "none", cursor: loading ? "default" : "pointer", opacity: loading || !methods.length ? 0.6 : 1 }}>
              {loading ? "Reading your valuation…" : "Get improvement plan"}
            </button>
            <button type="button" onClick={() => runAdvisor(true)} disabled={loading}
              style={{ marginLeft: 12, borderRadius: 6, padding: "10px 20px", fontSize: 14, fontWeight: 600, color: C.text, background: "transparent", border: `1px solid ${C.steel}`, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}>
              Show sample plan
            </button>

            {err && <div style={{ marginTop: 16, fontSize: 14, borderRadius: 6, padding: "10px 14px", background: "rgba(224,103,74,0.12)", color: "#F0A08A" }}>{err}</div>}

            {advice && (
              <div ref={resultRef} style={{ marginTop: 24 }}>
                <div style={{ borderRadius: 6, padding: 16, marginBottom: 12, background: C.navy, border: `1px solid ${C.panelEdge}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", color: C.steel }}>THE READ</span>
                    {advice.isSample && (
                      <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.08em", padding: "2px 6px", borderRadius: 4, background: C.ice, color: C.navy }}>{SAMPLE_BADGE}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 14, marginTop: 8, color: C.text }}>{advice.read}</p>
                  {advice.spread && <p style={{ fontSize: 14, marginTop: 10, color: C.mute }}>{advice.spread}</p>}
                </div>

                <p style={{ fontSize: 11, color: C.mute, margin: "0 0 10px" }}>{MODELED_ESTIMATES_LINE}</p>

                {advice.levers.map((l, i) => (
                  <div key={i} style={{ borderRadius: 6, padding: 16, marginBottom: 10, background: C.navy, border: `1px solid ${C.panelEdge}` }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: mono, fontSize: 11, color: C.ice }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ fontFamily: display, fontWeight: 700, fontSize: 16 }}>{l.title}</span>
                      <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 4, fontFamily: mono, fontSize: 11, color: C.navy, background: C.ice }}>+{l.upliftLow}–{l.upliftHigh}% (modeled)</span>
                    </div>
                    <p style={{ fontSize: 14, marginBottom: 8, color: C.mute }}>{l.diagnosis}</p>
                    <p style={{ fontSize: 14, color: C.text }}>{l.action}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.panelEdge}`, fontFamily: mono, fontSize: 11 }}>
                      <span style={{ color: effortColor(l.effort) }}>Effort: {l.effort}</span>
                      <span style={{ color: C.mute }}>Timeframe: {l.timeframe}</span>
                      <span style={{ color: C.mute }}>Moves: {l.methods.join(", ")}</span>
                    </div>
                  </div>
                ))}

                {advice.caution && (
                  <div style={{ borderRadius: 6, padding: 16, fontSize: 14, background: "rgba(224,103,74,0.1)", color: "#F0A08A", border: "1px solid rgba(224,103,74,0.3)" }}>
                    <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em" }}>DILIGENCE RISK — </span>{advice.caution}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>,
  );
}
