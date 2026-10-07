/**
 * Founder fields that fill an email's terms ("Raise: $500k – $1m" lines), shared by the
 * server-side founder fill and the template editor's Founder data panel (Remove / Add back).
 */
export const TERM_LABEL: Record<string, string> = { raise: "Raise", funding_stage: "Funding stage", capital_type: "Capital type", revenue: "Revenue", use_of_funds: "Use of funds" };
export const TERM_FIELDS = Object.keys(TERM_LABEL);

/** The part of a founder value that goes in the terms ("$500k – $1m (request) · range …" → "$500k – $1m"). */
export function termValue(key: string, value: string): string {
  if (key === "raise") return value.split(" (")[0].split(" · ")[0].trim();
  if (key === "funding_stage" || key === "revenue") return value.split(" · ")[0].trim();
  return value.trim();
}
export const termLine = (key: string, value: string) => `${TERM_LABEL[key]}: ${termValue(key, value)}`;

const isLineOf = (line: string, key: string) => line.trim().toLowerCase().startsWith(`${TERM_LABEL[key].toLowerCase()}:`);
export const hasTermLine = (text: string, key: string) => !!TERM_LABEL[key] && text.split("\n").some((l) => isLineOf(l, key));
export const removeTermLine = (text: string, key: string) => text.split("\n").filter((l) => !isLineOf(l, key)).join("\n").trim();

/** Put a term line back in its usual order; lines the user typed stay where they are. */
export function addTermLine(text: string, key: string, value: string): string {
  if (!TERM_LABEL[key] || hasTermLine(text, key)) return text;
  const lines = text.trim() ? text.split("\n") : [];
  const order = (l: string) => TERM_FIELDS.findIndex((k) => isLineOf(l, k));
  const me = TERM_FIELDS.indexOf(key);
  let at = lines.findIndex((l) => order(l) > me);
  if (at < 0) { const lastTerm = lines.map(order).reduce((acc, o, i) => (o >= 0 ? i : acc), -1); at = lastTerm + 1; }
  lines.splice(at, 0, termLine(key, value));
  return lines.join("\n");
}
