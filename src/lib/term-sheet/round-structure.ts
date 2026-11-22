// Pull blanks from the Round structure, and tell the founder what the template has no slot for.
import { fieldsFor } from "./fields";
import { groupNumber, normalizeInput } from "./render";
import type { LinkedField, RoundStructureInputs, RoundStructureKey, TermSheetFormType, TermSheetValues } from "./types";

export interface NotPlaced {
  label: string;
  value: string;
  reason: string;
}

export function suggestFormType(rt: RoundStructureInputs["roundType"]): TermSheetFormType {
  return rt === "note" ? "convertible_note" : rt === "priced" ? "series_a" : "safe";
}

function money(n: number): string {
  return groupNumber(String(Math.round(n)));
}

function pct(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** The Round structure value for one input, as the text a blank would hold. Null when there is nothing to place. */
export function roundStructureValue(key: RoundStructureKey, rs: RoundStructureInputs): string | null {
  switch (key) {
    case "raise":
      return rs.raiseAmount > 0 ? money(rs.raiseAmount) : null;
    case "cap":
      return rs.preMoney > 0 ? money(rs.preMoney) : null;
    case "interest":
      return rs.interestPct > 0 ? pct(rs.interestPct) : null;
    case "disc":
      return rs.discountPct > 0 ? pct(rs.discountPct) : null;
    case "warrant":
      return rs.warrantPct > 0 ? pct(rs.warrantPct) : null;
  }
}

/** Series A post money is derived: pre money plus the raise. */
export function derivedPostMoney(rs: RoundStructureInputs): string | null {
  return rs.preMoney > 0 && rs.raiseAmount > 0 ? money(rs.preMoney + rs.raiseAmount) : null;
}

export interface PullResult {
  values: TermSheetValues;
  linked: Record<string, LinkedField>;
}

/** Values for every blank that has a Round structure input, for this template. Blanks with no input are left out. */
export function pullFromRoundStructure(form: TermSheetFormType, rs: RoundStructureInputs): PullResult {
  const values: TermSheetValues = {};
  const linked: Record<string, LinkedField> = {};
  for (const f of fieldsFor(form)) {
    if (!f.rs) continue;
    const v = roundStructureValue(f.rs, rs);
    if (v === null) continue;
    values[f.id] = v;
    linked[f.id] = { key: f.rs, value: v };
  }
  if (form === "series_a") {
    const post = derivedPostMoney(rs);
    if (post) {
      values.postmoney = post;
      linked.postmoney = { key: "derived", value: post };
    }
  }
  return { values, linked };
}

/** Round structure values the template has no blank for, and why. */
export function notPlaced(form: TermSheetFormType, rs: RoundStructureInputs): NotPlaced[] {
  const out: NotPlaced[] = [];
  if (form === "convertible_note") {
    out.push({ label: "Maturity", value: `${rs.maturityMonths} months`, reason: "The Note template says within two years and has no blank for it." });
    out.push({ label: "Option pool", value: `${rs.optionPoolPct}%`, reason: "The Note template has no option pool blank." });
  }
  if (form === "safe") {
    out.push({ label: "Cap type", value: rs.safeType === "post_money" ? "Post-money" : "Pre-money", reason: "The SAFE template is a post money SAFE and has no blank for cap type." });
    out.push({ label: "Interest rate", value: `${pct(rs.interestPct)}%`, reason: "A SAFE has no interest." });
    out.push({ label: "Option pool", value: `${rs.optionPoolPct}%`, reason: "The SAFE template has no option pool blank." });
  }
  if (form === "series_a") {
    out.push({ label: "Option pool", value: `${rs.optionPoolPct}%`, reason: "The Series A template fixes the option pool at 10% and has no blank for it." });
    out.push({ label: "Discount", value: `${pct(rs.discountPct)}%`, reason: "The Series A template has no discount blank." });
    out.push({ label: "Interest rate", value: `${pct(rs.interestPct)}%`, reason: "The Series A template has no interest blank." });
  }
  return out;
}

export type LinkState = "synced" | "stale" | "edited" | "none";

export interface FieldLinkStatus {
  id: string;
  state: LinkState;
  /** The Round structure value now, when there is one. */
  current: string | null;
}

/**
 * For each blank with a Round structure input: synced (matches), stale (the Round structure changed since
 * the pull and the founder has not touched the blank), edited (the founder typed something else), or none.
 */
export function linkStatuses(
  form: TermSheetFormType,
  values: TermSheetValues,
  linked: Record<string, LinkedField>,
  rs: RoundStructureInputs | null,
): FieldLinkStatus[] {
  if (!rs) return [];
  const pulled = pullFromRoundStructure(form, rs);
  const out: FieldLinkStatus[] = [];
  for (const f of fieldsFor(form)) {
    const current = pulled.values[f.id] ?? null;
    if (current === null) continue;
    const mine = normalizeInput(f, values[f.id] ?? "");
    const link = linked[f.id];
    if (mine === current) out.push({ id: f.id, state: "synced", current });
    else if (link && mine === normalizeInput(f, link.value)) out.push({ id: f.id, state: "stale", current });
    else if (mine) out.push({ id: f.id, state: "edited", current });
    else out.push({ id: f.id, state: "none", current });
  }
  return out;
}

/** True when the saved Round structure no longer matches blanks that were pulled and left untouched. */
export function hasStaleLinks(statuses: FieldLinkStatus[]): boolean {
  return statuses.some((s) => s.state === "stale");
}

/** Update only the stale (untouched) linked blanks. Edited blanks are left alone. */
export function applyStale(
  values: TermSheetValues,
  linked: Record<string, LinkedField>,
  statuses: FieldLinkStatus[],
): PullResult {
  const nextValues = { ...values };
  const nextLinked = { ...linked };
  for (const s of statuses) {
    if (s.state !== "stale" || s.current === null) continue;
    nextValues[s.id] = s.current;
    nextLinked[s.id] = { key: nextLinked[s.id]?.key ?? "derived", value: s.current };
  }
  return { values: nextValues, linked: nextLinked };
}
