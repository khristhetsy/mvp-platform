import { fieldMap, isFormType } from "./fields";
import { normalizeInput } from "./render";
import type { LinkedField, RoundStructureInputs, TermSheetFormType, TermSheetValues } from "./types";

const MAX_LEN = 120;

/** Keep only known blank ids with short text values. Everything else in the body is ignored. */
export function sanitizeValues(form: TermSheetFormType, input: unknown): TermSheetValues {
  const defs = fieldMap(form);
  const out: TermSheetValues = {};
  if (!input || typeof input !== "object") return out;
  for (const [id, v] of Object.entries(input as Record<string, unknown>)) {
    const def = defs[id];
    if (!def || typeof v !== "string") continue;
    const t = v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, MAX_LEN);
    if (t) out[id] = def.kind === "words" || def.kind === "num" ? normalizeInput(def, t) : t;
  }
  return out;
}

export function sanitizeLinked(form: TermSheetFormType, input: unknown): Record<string, LinkedField> {
  const defs = fieldMap(form);
  const out: Record<string, LinkedField> = {};
  if (!input || typeof input !== "object") return out;
  for (const [id, v] of Object.entries(input as Record<string, unknown>)) {
    if (!defs[id] || !v || typeof v !== "object") continue;
    const o = v as { key?: unknown; value?: unknown };
    const key = o.key;
    if (typeof o.value !== "string") continue;
    if (key === "raise" || key === "cap" || key === "interest" || key === "disc" || key === "warrant" || key === "derived") {
      out[id] = { key, value: o.value.slice(0, MAX_LEN) };
    }
  }
  return out;
}

export function parseFormType(v: unknown): TermSheetFormType | null {
  return isFormType(v) ? v : null;
}

export function cleanRoundStructure(i: unknown): RoundStructureInputs | null {
  if (!i || typeof i !== "object") return null;
  const o = i as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    roundType: o.roundType === "note" || o.roundType === "priced" ? o.roundType : "safe",
    safeType: o.safeType === "pre_money" ? "pre_money" : "post_money",
    preMoney: n(o.preMoney),
    raiseAmount: n(o.raiseAmount),
    optionPoolPct: n(o.optionPoolPct),
    discountPct: n(o.discountPct),
    interestPct: n(o.interestPct),
    maturityMonths: n(o.maturityMonths),
    warrantPct: n(o.warrantPct),
  };
}
