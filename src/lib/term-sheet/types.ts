// Term sheet creator types. The creator fills in the three revised direct to investor
// term sheet templates. It never adds, removes or rewrites a clause: only the blanks change.

export type TermSheetFormType = "convertible_note" | "safe" | "series_a";
export const TERM_SHEET_FORM_TYPES: TermSheetFormType[] = ["convertible_note", "safe", "series_a"];

/** Which Round structure input a blank can be pulled from. */
export type RoundStructureKey = "raise" | "cap" | "interest" | "disc" | "warrant";

export interface TermSheetFieldDef {
  id: string;
  label: string;
  /** The clause the blank sits in (the left list in the creator). */
  sec: string;
  /** text: typed as is. num: prefix + value + suffix. words: a number printed as "four (4)". */
  kind: "text" | "num" | "words";
  /** The text printed in the template for the first place the blank appears. */
  ph: string;
  /** Required blank. Not required means the template prints a value the founder may keep or change. */
  req: boolean;
  prefix?: string;
  suffix?: string;
  core?: string;
  default?: string | null;
  rs?: RoundStructureKey | null;
}

/** Field id to the text the founder typed (raw, before prefix and suffix). */
export type TermSheetValues = Record<string, string>;

export type TermSheetSource = "round_structure" | "scratch" | "uploaded";
export type TermSheetStatus = "draft" | "finalized";

/** A blank that was pulled from the Round structure, with the value at the time of the pull. */
export interface LinkedField {
  key: RoundStructureKey | "derived";
  value: string;
}

export interface TermSheet {
  id: string;
  companyId: string;
  formType: TermSheetFormType;
  source: TermSheetSource;
  status: TermSheetStatus;
  title: string;
  values: TermSheetValues;
  linkedFields: Record<string, LinkedField>;
  documentId: string | null;
  noticeAcknowledgedAt: string | null;
  roundStructureSyncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  finalizedAt: string | null;
}

/** The Round structure inputs the creator can read (same shape the calculator uses). */
export interface RoundStructureInputs {
  roundType: "safe" | "note" | "priced";
  safeType: "pre_money" | "post_money";
  preMoney: number;
  raiseAmount: number;
  optionPoolPct: number;
  discountPct: number;
  interestPct: number;
  maturityMonths: number;
  warrantPct: number;
}
