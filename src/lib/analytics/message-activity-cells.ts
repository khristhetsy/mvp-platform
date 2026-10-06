// What each cell of the "By person" table says, and how dark it is shaded.
// Pure, so the table and the tests share it.

import { shortDay, localDay, sourceLabel, type ReceivedItem, type SentItem } from "./message-activity-metrics";

/** 0 for none, else 1..steps by share of the column's busiest row. */
export function heatLevel(n: number, columnMax: number, steps: number): number {
  if (n <= 0 || columnMax <= 0) return 0;
  return Math.min(steps, Math.max(1, Math.ceil((n / columnMax) * steps)));
}

export type CellText = { count: number; status: string; detail: string; tip: string };

/** "4 sent · 1 skipped", most common status first; just "sent" when all share one. */
function statusMix(statuses: string[]): string {
  const m = new Map<string, number>();
  for (const s of statuses) m.set(s, (m.get(s) ?? 0) + 1);
  if (m.size === 1) return [...m.keys()][0];
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${n} ${s}`).join(" · ");
}

/** "Overdue alert" → "Overdue". */
function shortSource(source: string): string {
  const label = sourceLabel(source).replace(/ (alert|reminder|notice)$/i, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Received items of one type for one person. Items are newest first. */
export function receivedCell(items: ReceivedItem[]): CellText {
  if (!items.length) return { count: 0, status: "", detail: "", tip: "" };
  const inApp = items.filter((i) => i.channel === "in_app");
  const emails = items.filter((i) => i.channel === "email");
  const status = [
    inApp.length ? `${inApp.filter((i) => i.status === "read").length} read` : "",
    emails.length ? statusMix(emails.map((i) => i.status)) : "",
  ].filter(Boolean).join(" · ");
  const bySource = new Map<string, number>();
  for (const i of items) {
    const k = shortSource(i.source);
    bySource.set(k, (bySource.get(k) ?? 0) + 1);
  }
  // One kind: the latest title says more than the kind. Several: count each kind.
  const detail =
    bySource.size === 1
      ? items[0].title
      : [...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
  return { count: items.length, status, detail, tip: `${detail}. Latest: ${items[0].title}` };
}

/** Sends of one kind for one founder. Items are newest first. */
export function sentCell(items: SentItem[], extra: { queued?: number; allowance?: { cap: number; used: number; resetsAt: string } } = {}): CellText {
  const status = [items.length ? statusMix(items.map((i) => i.status)) : "", extra.queued ? `${extra.queued} queued` : ""]
    .filter(Boolean).join(" · ");
  const names = [...new Set(items.map((i) => i.investor))];
  let detail = names.length ? names[0] + (names.length > 1 ? ` +${names.length - 1}` : "") : "";
  if (!items.length && extra.allowance) {
    const a = extra.allowance;
    const reset = shortDay(localDay(a.resetsAt));
    detail = a.used >= a.cap ? `Full until ${reset}` : `${a.cap - a.used} of ${a.cap} left`;
    return { count: 0, status, detail, tip: `Plan reaches ${a.cap} investors every 30 days. ${a.used} reached so far; resets ${reset}.` };
  }
  return { count: items.length, status, detail, tip: names.length ? names.join(", ") : detail };
}
