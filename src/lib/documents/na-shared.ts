// Shared "Not applicable" rules: safe to import from client and server code.
// One rule everywhere: an item marked N/A counts as complete, and it always
// shows a note saying it was marked N/A (who, when in PT, and why).

/**
 * Document types a founder may mark "Not applicable" — every required type plus
 * Other. Canonical codes (the checklist's own codes). Marking N/A completes the
 * step; the Capital Readiness Rating engine still scores only real uploads.
 */
export const NA_ALLOWED_TYPES = new Set([
  "PITCH_DECK",
  "BUSINESS_PLAN",
  "FINANCIAL_MODEL",
  "CAP_TABLE",
  "TEAM_BIOS",
  "LEGAL_DOCUMENTS",
  "CORPORATE_DOCUMENTS",
  "CUSTOMER_CONTRACTS",
  "MARKET_RESEARCH",
  "OTHER",
]);

/** Normalize a UI or upload document-type value to the canonical checklist code. */
export function normalizeNaType(input: string): string {
  const value = input.toUpperCase().trim();
  if (value === "LEGAL_DOCUMENT") return "LEGAL_DOCUMENTS";
  if (value === "FINANCIALS" || value === "FINANCIAL_STATEMENTS") return "FINANCIAL_MODEL";
  return value;
}

/** One saved N/A marker, ready to display. */
export type NaEntry = {
  /** Canonical code. */
  documentType: string;
  note: string | null;
  markedAt: string | null;
  markedByName: string | null;
};

/** "Oct 8, 2026 3:12 PM PT" — every iCapOS time shows in Pacific time. */
export function formatPt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${s.replace(/,(?=\s\d{1,2}:)/, "")} PT`;
}

/** "Marked N/A by Jane Founder · Oct 8, 2026 3:12 PM PT" (parts drop out when unknown). */
export function naMarkedLine(entry: { markedByName?: string | null; markedAt?: string | null }): string {
  const who = entry.markedByName ? ` by ${entry.markedByName}` : "";
  const when = formatPt(entry.markedAt);
  return `Marked N/A${who}${when ? ` · ${when}` : ""}`;
}

/** Step note: "1 item marked N/A: Customer contracts" / "2 sections marked N/A: A, B". */
export function naSummaryNote(labels: string[], noun: "item" | "section" = "item"): string | undefined {
  if (!labels.length) return undefined;
  return `${labels.length} ${noun}${labels.length === 1 ? "" : "s"} marked N/A: ${labels.join(", ")}`;
}
