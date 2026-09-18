/**
 * Odoo → IR Hub parsing — pure, client-safe. Turns the Deals2Match export into
 * proposals staff confirm: monthly Odoo projects grouped per founder (with name-drift
 * repair), investor tags split into name + firm, and Agent Field text split into dated
 * activities with a stage inference. Nothing here writes; the import executor does.
 */
import { INTRO_SUBJECT, type IrActivityType, type IrStage } from "@/lib/ir/types";

// ── Project names: "Micheal Doyle-3rd-Month" → founder "Michael Doyle", month 3 ────
const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };

/** Month index from "1st Month", "Month 3", "3rd-Month", "third month"; null when absent. */
export function monthIndex(name: string): number | null {
  const s = name.toLowerCase().replace(/[-_]+/g, " ");
  let m = s.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s*month/); if (m) return Number(m[1]);
  m = s.match(/month\s*(\d{1,2})/); if (m) return Number(m[1]);
  m = s.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\b\s*month/); if (m) return ORDINALS[m[1]];
  m = s.match(/\bm(\d{1,2})\b/); if (m) return Number(m[1]);
  return null;
}
/** Founder part of a project name: everything before the month token, tidied. */
export function founderPart(name: string): string {
  return name.replace(/[-_]+/g, " ").replace(/\b\d{1,2}\s*(?:st|nd|rd|th)?\s*month\b.*$/i, "").replace(/\bmonth\s*\d{1,2}\b.*$/i, "")
    .replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s*month\b.*$/i, "").replace(/\s{2,}/g, " ").trim();
}
/** Week number from a task title such as "Michael Doyle Week 22"; null when absent. */
export function weekIndex(title: string): number | null {
  const m = title.match(/\bw(?:ee)?k\s*(\d{1,2})\b/i); return m ? Number(m[1]) : null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export type OdooProjectLite = { id: number; name: string; taskCount: number; dateStart: string | null; userName: string | null };
export type ProjectGroup = { key: string; founder: string; projects: Array<OdooProjectLite & { month: number | null; nameFixed: boolean }>; months: number };

/** Group monthly Odoo projects per founder; names within edit distance 2 of the group's canonical name are treated as drift and flagged. */
export function groupProjects(projects: OdooProjectLite[]): ProjectGroup[] {
  const groups: ProjectGroup[] = [];
  for (const p of projects) {
    const founder = founderPart(p.name); const n = norm(founder);
    let g = groups.find((x) => norm(x.founder) === n) ?? groups.find((x) => editDistance(norm(x.founder), n) <= 2);
    if (!g) { g = { key: n || String(p.id), founder, projects: [], months: 0 }; groups.push(g); }
    // Canonical = the most common spelling in the group
    g.projects.push({ ...p, month: monthIndex(p.name), nameFixed: false });
    const counts = new Map<string, number>();
    for (const x of g.projects) counts.set(founderPart(x.name), (counts.get(founderPart(x.name)) ?? 0) + 1);
    g.founder = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    for (const x of g.projects) x.nameFixed = founderPart(x.name) !== g.founder;
    g.projects.sort((a, b) => (a.month ?? 99) - (b.month ?? 99) || a.id - b.id);
    g.months = Math.max(g.projects.length, ...g.projects.map((x) => x.month ?? 0));
  }
  return groups.sort((a, b) => a.founder.localeCompare(b.founder));
}

// ── Investor tags: "Privos Capital, Dan Farrell" / "Jeff M. Fettig" / "Bob (Chatham ...)" ──
export type ParsedTag = { raw: string; name: string | null; firm: string | null; email: string | null };
const FIRM_HINT = /\b(capital|ventures?|partners?|fund|group|inc\.?|llc|lp|holdings|investments?|equity|advisors?|management|co\.?|corp|company|family office|angels?)\b/i;
export function parseTag(raw: string): ParsedTag {
  const email = raw.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]?.toLowerCase() ?? null;
  let s = raw.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/, "").replace(/\s{2,}/g, " ").trim();
  let firm: string | null = null; let name: string | null = null;
  const paren = s.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (paren) { s = paren[1].trim(); firm = paren[2].trim(); }
  const parts = s.split(/\s*[,|–—-]\s+|\s*[,|]\s*/).map((x) => x.trim()).filter(Boolean)
    .reduce<string[]>((acc, x) => { if (acc.length && /^(inc|llc|lp|llp|ltd|corp|co|plc|gmbh|sa)\.?$/i.test(x)) acc[acc.length - 1] += `, ${x}`; else acc.push(x); return acc; }, []);
  if (parts.length >= 2) {
    const [a, b] = [parts[0], parts.slice(1).join(", ")];
    const aFirm = FIRM_HINT.test(a) || a.split(/\s+/).length > 3, bFirm = FIRM_HINT.test(b) || b.split(/\s+/).length > 3;
    if (aFirm && !bFirm) { firm = firm ?? a; name = b; } else if (bFirm && !aFirm) { firm = firm ?? b; name = a; } else { firm = firm ?? a; name = b; }
  } else if (parts.length === 1) {
    if (!firm && FIRM_HINT.test(parts[0]) && parts[0].split(/\s+/).length > 2) firm = parts[0]; else name = parts[0];
  }
  return { raw, name: name || null, firm: firm || null, email };
}

// ── Agent Field: "Sent intro email 4/22/26 | Called, no answer (1st call) 4/23/26 | Left a voicemail 4/24/26 (edited)" ──
export type ParsedEntry = { text: string; type: IrActivityType; subject: string; outcome: string; date: string | null; dateText: string | null; investorHint: string | null };

export function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
}
/** "4/22/26", "04-22-2026", "2026-04-22", "Apr 22, 2026" → YYYY-MM-DD; null when unreadable. */
export function parseDate(text: string): { iso: string | null; raw: string | null } {
  let m = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return { iso: iso(Number(m[1]), Number(m[2]), Number(m[3])), raw: m[0] };
  m = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (m) { const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]); return { iso: iso(y, Number(m[1]), Number(m[2])), raw: m[0] }; }
  m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/i);
  if (m) { const mon = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1].slice(0, 3).toLowerCase()) + 1; return { iso: m[3] ? iso(Number(m[3]), mon, Number(m[2])) : null, raw: m[0] }; }
  return { iso: null, raw: null };
}
function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d)); return dt.getUTCMonth() === mo - 1 ? dt.toISOString().slice(0, 10) : null;
}

export function classifyEntry(text: string): { type: IrActivityType; subject: string } {
  const t = text.toLowerCase();
  if (/intro(duction)?\s*(email|e-mail)|sent\s+intro/.test(t)) return { type: "email", subject: INTRO_SUBJECT };
  if (/term\s*sheet/.test(t)) return { type: "term_sheet", subject: "Term sheet" };
  if (/voicemail|\bvm\b|left (a )?message/.test(t)) return { type: "voicemail", subject: "Left voicemail" };
  if (/\b(meeting|met with|zoom|call held|intro call|discovery call|pitch(ed)?)\b/.test(t) && !/no answer|voicemail/.test(t)) return { type: "meeting", subject: "Meeting" };
  if (/\b(call(ed|s)?|phone|dial(ed)?|spoke|talked)\b/.test(t)) return { type: "call", subject: "Call" };
  if (/\b(email(ed)?|e-mail|sent (the )?(deck|follow|note|update)|replied|reply|responded|follow[- ]?up)\b/.test(t)) return { type: "email", subject: /follow/.test(t) ? "Follow-up email" : "Email" };
  if (/\b(deck|data room|document|sent (the )?(one[- ]pager|memo|materials))\b/.test(t)) return { type: "document", subject: "Document shared" };
  return { type: "note", subject: "Update" };
}

/** Split the field into entries. Lines may start with an investor name ("Dan Farrell: …"); the hint is kept for attribution. */
export function parseAgentField(text: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  const clean = stripHtml(text).replace(/\(edited\)/gi, "").replace(/\r/g, "");
  for (const line of clean.split(/\n+/)) {
    let rest = line.trim(); if (!rest) continue;
    let hint: string | null = null;
    const lead = rest.match(/^([A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){0,3})\s*[:–—-]\s+(.*)$/);
    if (lead && !/^(sent|called|left|emailed|met|spoke|follow|intro|meeting|no|replied)\b/i.test(lead[1])) { hint = lead[1].trim(); rest = lead[2]; }
    for (const seg of rest.split(/\s*\|\s*|\s*;\s+|\s+\/\/\s+/)) {
      const s = seg.trim(); if (!s) continue;
      const { iso: date, raw } = parseDate(s);
      const body = (raw ? s.replace(raw, "") : s).replace(/\s{2,}/g, " ").replace(/[\s,;-]+$/, "").trim();
      const { type, subject } = classifyEntry(body || s);
      out.push({ text: s, type, subject, outcome: body || s, date, dateText: raw, investorHint: hint });
    }
  }
  return out;
}

/** Stage implied by a set of parsed entries (later entries win; explicit outcomes beat types). */
export function inferStage(entries: Array<Pick<ParsedEntry, "type" | "outcome" | "subject">>): IrStage {
  const order: IrStage[] = ["matched", "intro_sent", "contacted", "meeting_scheduled", "meeting_held", "follow_up", "committed", "passed"];
  let best = 0; let passed = false; let committed = false;
  for (const e of entries) {
    const t = e.outcome.toLowerCase();
    if (/\b(passed|pass(ing)? on|not interested|declined|no fit|out for now)\b/.test(t)) passed = true;
    if (/\b(committed|commitment|invest(ed|ing)|wired|signed|closed)\b/.test(t) || e.type === "term_sheet") committed = true;
    let s: IrStage = "matched";
    if (e.subject === INTRO_SUBJECT) s = "intro_sent";
    else if (e.type === "meeting") s = /\b(scheduled|booked|set|confirmed|upcoming)\b/.test(t) && !/\b(held|done|had|completed)\b/.test(t) ? "meeting_scheduled" : "meeting_held";
    else if (/follow[- ]?up/.test(t) && best >= order.indexOf("meeting_held")) s = "follow_up";
    else if (e.type === "call" && /no answer|didn'?t pick|left|voicemail|no response/.test(t)) s = "intro_sent";
    else if (e.type === "voicemail") s = "intro_sent";
    else if (e.type === "call" || (e.type === "email" && /\b(replied|reply|responded|spoke|connected|answered)\b/.test(t))) s = "contacted";
    else if (e.type === "email" || e.type === "document") s = "intro_sent";
    best = Math.max(best, order.indexOf(s));
  }
  if (committed) return "committed";
  if (passed) return "passed";
  return order[best];
}

/** Attribute entries to the task's investors: explicit line hints win (by full name, last name or firm); otherwise a single-investor task owns everything. */
export function attributeEntries<T extends { key: string; name: string | null; firm: string | null }>(entries: ParsedEntry[], investors: T[]): Array<ParsedEntry & { investorKey: string | null }> {
  const find = (hint: string): T | null => {
    const h = norm(hint);
    return investors.find((i) => norm(i.name ?? "") === h) ?? investors.find((i) => (i.name ?? "").split(/\s+/).some((p) => norm(p) === h && p.length > 2)) ?? investors.find((i) => norm(i.firm ?? "").startsWith(h) && h.length > 3) ?? investors.find((i) => norm(i.name ?? "").startsWith(h) && h.length > 3) ?? null;
  };
  let last: string | null = null;
  return entries.map((e) => {
    if (e.investorHint) { const inv = find(e.investorHint); last = inv?.key ?? null; return { ...e, investorKey: last }; }
    return { ...e, investorKey: last ?? (investors.length === 1 ? investors[0].key : null) };
  });
}
