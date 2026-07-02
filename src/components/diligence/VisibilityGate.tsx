"use client";
import { useTranslations } from "next-intl";

export type GateRow = { founder_visible: boolean; investor_visible: boolean };
export type GateMap = Record<string, GateRow>;

const SECTIONS: { key: string; label: string; hint?: string }[] = [
  { key: "findings", label: "Findings" },
  { key: "responses", label: "Responses" },
  { key: "data_room", label: "Data room" },
  { key: "candor", label: "Candor", hint: "internal notes" },
  { key: "icfo_review", label: "iCFO review", hint: "dispositions" },
  { key: "verdict", label: "Verdict", hint: "posture / recommendation" },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? "bg-[#1d7a4d]" : "bg-slate-300"}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export function VisibilityGate({ gate, onToggle }: { gate: GateMap; onToggle: (section: string, who: "founder" | "investor", visible: boolean) => void }) {
  const t = useTranslations("sharedCmp");
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="flex-1">{t("section")}</span>
        <span className="w-20 text-center">{t("founder")}</span>
        <span className="w-20 text-center">{t("investor")}</span>
      </div>
      {SECTIONS.map((s) => {
        const row = gate[s.key] ?? { founder_visible: false, investor_visible: false };
        return (
          <div key={s.key} className="flex items-center border-b border-slate-50 px-3 py-2 last:border-0">
            <span className="flex-1 text-sm text-slate-800">{s.label}{s.hint ? <span className="ml-1 text-xs text-slate-400">({s.hint})</span> : null}</span>
            <span className="flex w-20 justify-center"><Toggle on={row.founder_visible} onChange={(v) => onToggle(s.key, "founder", v)} /></span>
            <span className="flex w-20 justify-center"><Toggle on={row.investor_visible} onChange={(v) => onToggle(s.key, "investor", v)} /></span>
          </div>
        );
      })}
    </div>
  );
}
