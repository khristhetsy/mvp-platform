/**
 * Recover Odoo activity history onto projects that were already imported.
 *
 * The first import kept an Agent Field entry only when it named one investor AND had a
 * date, and re-runs skip investors already on the project, so tasks carrying many
 * investors came through with stages but no activity. This pass re-reads Odoo
 * (read-only) and, for every dated entry on an imported task:
 *   - names an investor on the task → activity on that investor's record
 *   - names no one               → activity on the task (counts on the dashboard,
 *                                   shows on the task, not on any one investor)
 * Idempotent: an entry already present (same task, investor, type, date and text) is
 * skipped, so it can run again after new Odoo notes. Undated entries and plain notes
 * are reported, never guessed. `dryRun` returns the plan without writing.
 *
 * Second source: the task chatter (mail.message). A logged note is parsed like the Agent
 * Field, an undated entry taking the note's own date; a completed Odoo activity (Call,
 * Meeting, Email…) becomes one entry of that type; an email on the task becomes one email.
 * System messages (stage changes, "Task created") classify as notes and are skipped.
 *
 * Third source: each investor's own contact chatter (res.partner). Staff log calls, emails
 * and completed activities on the investor, naming the founder or company ("Doyle Organics",
 * "Holo MD – call no answer"). A message counts for this project only when it names the
 * founder, a co-founder or the company; it lands on that investor's record, on the task the
 * investor was on at that date. Open (not yet done) Odoo activities are counted, not imported.
 */
import { db, updateMatch } from "@/lib/ir/db";
import { discover, inferStage, odooTasks, taskEntries, type OdooTaskLite } from "@/lib/ir/odoo-import";
import { attributeEntries, classifyEntry, parseAgentField, parseTag, stripHtml, type ParsedEntry } from "@/lib/ir/odoo-parse";
import { executeKw } from "@/lib/crm-connectors/odoo/client";
import { IR_STAGES, type IrStage } from "@/lib/ir/types";
import { founderOdooProfile } from "@/lib/ir/founder-profile";

export type ResyncActivity = { taskId: string; matchId: string | null; type: string; subject: string; outcome: string; date: string; assigneeId: string | null };
export type ResyncCounts = { email: number; call: number; voicemail: number; meeting: number; term_sheet: number; document: number };
export type ResyncResult = {
  projectId: string; dryRun: boolean;
  odooTasks: number; tasksWithNotes: number; entries: number; chatterMessages: number; chatterEntries: number;
  toAdd: ResyncCounts & { total: number; onInvestor: number; onTask: number };
  partnerMessages: number; partnerEntries: number; openOdooActivities: number; keywords: string[];
  alreadyPresent: number; skippedUndated: number; skippedNotes: number; tasksNotImported: number;
  stagesAdvanced: number; movedToInvestor: number; sample: Array<{ date: string; type: string; outcome: string; investor: string | null }>;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);
export const activityKey = (a: { taskId: string | null; matchId: string | null; type: string; date: string; outcome: string }) =>
  `${a.taskId ?? ""}|${a.matchId ?? ""}|${a.type}|${a.date}|${norm(a.outcome)}`;

/** The same entry as first stored, before its "(Investor)-" lead was read as the investor: text without that lead. */
export const looseKey = (a: { taskId: string | null; type: string; date: string; outcome: string }) =>
  `${a.taskId ?? ""}|${a.type}|${a.date}|${norm(a.outcome.replace(/^\(([^()]{2,80})\)\s*[:–—-]*\s*/, ""))}`;

/** A date an entry can really carry: from 2024 up to tomorrow. Typos ("8/3/07", "2/6/30") read as undated. */
export const plausibleDate = (d: string | null, today: string = new Date().toISOString().slice(0, 10)) => {
  if (!d) return false;
  const max = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return d >= "2024-01-01" && d <= max;
};

export type OdooMessage = { res_id: number; date: string; body: string; message_type: string; activityType: string | null };

/** Entries from one task's chatter, attributed to the task's investors like Agent Field lines. */
export function messageEntries(msgs: OdooMessage[], tags: Array<{ name: string }>): Array<ParsedEntry & { investorKey: string | null }> {
  const inv = tags.map((g) => { const p = parseTag(g.name); return { key: g.name, name: p.name, firm: p.firm }; });
  const out: Array<ParsedEntry & { investorKey: string | null }> = [];
  for (const m of msgs) {
    const day = m.date ? m.date.slice(0, 10) : null;
    const text = stripHtml(m.body ?? "").replace(/\s+/g, " ").trim();
    let es: ParsedEntry[];
    if (m.activityType) {
      const { type, subject } = classifyEntry(`${m.activityType} ${text}`);
      es = [{ text: text || m.activityType, type: type === "note" ? "note" : type, subject, outcome: (text || `${m.activityType} done`).slice(0, 2000), date: day, dateText: null, investorHint: null }];
    } else if (m.message_type === "email") {
      es = text ? [{ text, type: "email", subject: "Email", outcome: text.slice(0, 500), date: day, dateText: null, investorHint: null }] : [];
    } else {
      es = parseAgentField(m.body ?? "").map((e) => ({ ...e, date: e.date ?? day }));
    }
    out.push(...attributeEntries(es, inv));
  }
  return out;
}


const GENERIC = new Set(["inc", "llc", "ltd", "corp", "group", "capital", "partners", "holdings", "company", "ventures", "global", "the", "and", "design", "business", "month", "week", "project"]);
const lc = (s: string) => s.toLowerCase().replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();

/** Words that identify this founder in free text: every full name / company given, plus each person's surname. */
export function founderKeywords(names: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const raw of names) {
    if (!raw) continue;
    for (const part of raw.split(/\s*(?:\/|&|,|\band\b|\+)\s*/i)) {
      const p = lc(part.replace(/\b(\d+(st|nd|rd|th)?[- ]?month|month[- ]?\d+)\b/gi, "").replace(/-/g, " "));
      if (p.length >= 4 && !GENERIC.has(p)) out.add(p);
      const words = p.split(" ").filter(Boolean);
      const last = words[words.length - 1];
      if (words.length >= 2 && last && last.length >= 4 && !GENERIC.has(last)) out.add(last);
    }
  }
  return [...out];
}

/** Keywords found in the text (whole words), ignoring any that are part of the investor's own name. */
export function mentions(text: string, keywords: string[], investorName = ""): boolean {
  const t = ` ${lc(text)} `; const own = ` ${lc(investorName)} `;
  return keywords.some((k) => !own.includes(` ${k} `) && t.includes(` ${k} `));
}

/**
 * Entries from the investors' own chatter that name this founder, keyed by the Odoo task
 * they belong to: the latest task (holding that investor) created on or before the message,
 * else the earliest such task. `msgs[].res_id` is the investor's res.partner id.
 */
export function partnerEntries(msgs: Array<OdooMessage & { subject?: string }>, tasks: Array<Pick<OdooTaskLite, "id" | "createDate" | "tags">>, keywords: string[]) {
  const byPartner = new Map<number, Array<{ id: number; createDate: string; key: string }>>();
  for (const t of tasks) for (const g of t.tags) byPartner.set(g.id, [...(byPartner.get(g.id) ?? []), { id: t.id, createDate: t.createDate, key: g.name }]);
  for (const l of byPartner.values()) l.sort((a, b) => a.createDate.localeCompare(b.createDate));
  const out = new Map<number, Array<ParsedEntry & { investorKey: string | null }>>();
  let matched = 0;
  for (const m of msgs) {
    const holders = byPartner.get(m.res_id); if (!holders?.length) continue;
    const text = `${m.subject ?? ""} ${m.activityType ?? ""} ${stripHtml(m.body ?? "")}`;
    if (!mentions(text, keywords, parseTag(holders[0].key).name ?? "")) continue;
    matched++;
    const day = m.date ? m.date.slice(0, 10) : "";
    const owner = [...holders].reverse().find((h) => h.createDate.slice(0, 10) <= day) ?? holders[0];
    let es = messageEntries([{ ...m, body: m.subject && !m.activityType ? `${m.subject}\n${m.body ?? ""}` : m.body }], [{ name: owner.key }])
      .map((e) => ({ ...e, investorKey: owner.key }));
    // A note covering several founders keeps only the lines that name this one.
    if (!m.activityType && es.length > 1) { const own = es.filter((e) => mentions(e.text, keywords)); if (own.length) es = own; }
    out.set(owner.id, [...(out.get(owner.id) ?? []), ...es]);
  }
  return { byTask: out, matched };
}

type IrTask = { id: string; odoo_task_id: number; assignee_id: string | null };
type IrMatch = { id: string; odoo_tag: string | null; stage: IrStage };

/** Pure: what the pass would add, given Odoo tasks and what the IR Hub already holds. */
export function planResync(tasks: Array<Pick<OdooTaskLite, "id" | "tags" | "agentText">>, irTasks: IrTask[], matches: IrMatch[], existingKeys: Set<string>, messages: OdooMessage[] = [], fromPartners: Map<number, Array<ParsedEntry & { investorKey: string | null }>> = new Map(), unattributed: Map<string, string> = new Map(), today?: string) {
  const msgsByTask = new Map<number, OdooMessage[]>();
  for (const m of messages) msgsByTask.set(m.res_id, [...(msgsByTask.get(m.res_id) ?? []), m]);
  let chatterEntries = 0, partnerCount = 0;
  const byOdoo = new Map(irTasks.map((t) => [t.odoo_task_id, t]));
  const byTag = new Map(matches.filter((m) => m.odoo_tag).map((m) => [m.odoo_tag as string, m]));
  const seen = new Set(existingKeys);
  const add: Array<ResyncActivity & { investor: string | null }> = [];
  // Entries stored on the task before their investor could be read: moved onto the investor, not added again.
  const attach: Array<{ id: string; matchId: string; outcome: string }> = [];
  const loose = new Map(unattributed);
  const stageEntries = new Map<string, Array<{ type: ResyncActivity["type"] & string; outcome: string; subject: string }>>();
  let entries = 0, tasksWithNotes = 0, already = 0, undated = 0, notes = 0, notImported = 0;
  for (const t of tasks) {
    const fromChatter = messageEntries(msgsByTask.get(t.id) ?? [], t.tags);
    chatterEntries += fromChatter.length;
    const fromPartner = fromPartners.get(t.id) ?? [];
    partnerCount += fromPartner.length;
    const es = [...taskEntries(t as OdooTaskLite), ...fromChatter, ...fromPartner];
    if (es.length) tasksWithNotes++;
    entries += es.length;
    const ir = byOdoo.get(t.id);
    if (!ir) { if (es.length) notImported++; continue; }
    for (const e of es) {
      if (e.type === "note") { notes++; continue; }
      if (!e.date || !plausibleDate(e.date, today)) { undated++; continue; }
      const match = e.investorKey ? byTag.get(e.investorKey) ?? null : null;
      const a: ResyncActivity = { taskId: ir.id, matchId: match?.id ?? null, type: e.type, subject: e.subject, outcome: e.outcome.slice(0, 2000), date: e.date, assigneeId: ir.assignee_id };
      const k = activityKey(a);
      if (seen.has(k)) { already++; continue; }
      seen.add(k);
      if (match) {
        const lk = looseKey(a); const rowId = loose.get(lk);
        if (rowId) {
          loose.delete(lk); attach.push({ id: rowId, matchId: match.id, outcome: a.outcome }); already++;
          stageEntries.set(match.id, [...(stageEntries.get(match.id) ?? []), { type: e.type, outcome: e.outcome, subject: e.subject }]);
          continue;
        }
      }
      add.push({ ...a, investor: match ? e.investorKey : null });
      if (match) stageEntries.set(match.id, [...(stageEntries.get(match.id) ?? []), { type: e.type, outcome: e.outcome, subject: e.subject }]);
    }
  }
  const stageMoves: Array<{ matchId: string; to: IrStage }> = [];
  for (const m of matches) {
    const es = stageEntries.get(m.id); if (!es) continue;
    const to = inferStage(es as Parameters<typeof inferStage>[0]);
    if (m.stage !== "passed" && IR_STAGES.indexOf(to) > IR_STAGES.indexOf(m.stage)) stageMoves.push({ matchId: m.id, to });
  }
  return { add, attach, stageMoves, entries, tasksWithNotes, already, undated, notes, notImported, chatterEntries, partnerEntries: partnerCount };
}

export async function resyncProject(projectId: string, by: string, dryRun = true): Promise<ResyncResult> {
  const { data: p } = await db().from("ir_projects").select("id, title, odoo_project_ids, founder_contact_id").eq("id", projectId).single();
  const proj = p as { title: string; odoo_project_ids: number[] | null; founder_contact_id: string | null } | null;
  const ids = proj?.odoo_project_ids ?? [];
  if (!ids.length) throw new Error("This project was not imported from Odoo.");
  const d = await discover();
  if (!d.configured) throw new Error("Odoo isn't configured on this environment.");
  const [tasks, tRes, mRes, aRes] = await Promise.all([
    odooTasks(ids, d, d.agentField),
    db().from("ir_tasks").select("id, odoo_task_id, assignee_id").eq("project_id", projectId).not("odoo_task_id", "is", null),
    db().from("ir_matches").select("id, odoo_tag, stage").eq("project_id", projectId),
    db().from("ir_activities").select("id, task_id, match_id, type, done_at, outcome").eq("project_id", projectId).not("done_at", "is", null).limit(50000),
  ]);
  const stored = (aRes.data ?? []) as Array<{ id: string; task_id: string | null; match_id: string | null; type: string; done_at: string; outcome: string | null }>;
  const existing = new Set(stored.map((a) => activityKey({ taskId: a.task_id, matchId: a.match_id, type: a.type, date: a.done_at.slice(0, 10), outcome: a.outcome ?? "" })));
  const unattributed = new Map(stored.filter((a) => !a.match_id && a.task_id).map((a) => [looseKey({ taskId: a.task_id, type: a.type, date: a.done_at.slice(0, 10), outcome: a.outcome ?? "" }), a.id] as const));
  // Task chatter, read-only. A failure here never blocks the Agent Field pass.
  type RawMsg = { res_id: number; date: string; body: string | false; message_type: string; mail_activity_type_id: [number, string] | false };
  const raw = tasks.length ? await executeKw<RawMsg[]>("mail.message", "search_read", [[["model", "=", "project.task"], ["res_id", "in", tasks.map((t) => t.id)], ["message_type", "in", ["comment", "email", "notification"]]]], { fields: ["res_id", "date", "body", "message_type", "mail_activity_type_id"], limit: 20000, order: "date asc" }).catch(() => [] as RawMsg[]) : [];
  const messages: OdooMessage[] = raw.map((m) => ({ res_id: m.res_id, date: m.date, body: m.body || "", message_type: m.message_type, activityType: m.mail_activity_type_id ? m.mail_activity_type_id[1] : null }))
    .filter((m) => m.activityType || m.message_type !== "notification");

  // Investors' own chatter (res.partner), read-only; only when the task's investor fields are contacts.
  const partnersAreContacts = d.investorFields.some((f) => f.relation === "res.partner");
  const partnerIds = partnersAreContacts ? [...new Set(tasks.flatMap((t) => t.tags.map((g) => g.id)))] : [];
  let keywords: string[] = [];
  let partnerRaw: Array<RawMsg & { subject: string | false }> = [];
  let openOdooActivities = 0;
  if (partnerIds.length) {
    const fc = proj?.founder_contact_id ? (await db().from("crm_contacts").select("name, company, raw").eq("id", proj.founder_contact_id).maybeSingle()).data as { name: string | null; company: string | null; raw: Record<string, unknown> | null } | null : null;
    // The founder as Odoo knows them: the customer on the tasks and that customer's company.
    const custIds = d.hasPartner ? await executeKw<Array<{ partner_id: [number, string] | false }>>("project.task", "read", [tasks.map((t) => t.id), ["partner_id"]]).then((r) => [...new Set(r.map((x) => (x.partner_id ? x.partner_id[0] : 0)).filter(Boolean))]).catch(() => [] as number[]) : [];
    const cust = custIds.length ? await executeKw<Array<{ name: string; commercial_company_name?: string | false; company_name?: string | false }>>("res.partner", "read", [custIds, ["name", "commercial_company_name", "company_name"]]).catch(() => []) : [];
    keywords = founderKeywords([proj?.title, fc?.name, fc?.company, fc?.raw ? founderOdooProfile(fc.raw)?.companyName : null, ...cust.flatMap((c) => [c.name, c.commercial_company_name || null, c.company_name || null])]);
    if (keywords.length) {
      partnerRaw = await executeKw<Array<RawMsg & { subject: string | false }>>("mail.message", "search_read", [[["model", "=", "res.partner"], ["res_id", "in", partnerIds], ["message_type", "in", ["comment", "email", "notification"]]]], { fields: ["res_id", "date", "body", "message_type", "mail_activity_type_id", "subject"], limit: 50000, order: "date asc" }).catch(() => []);
      const open = await executeKw<Array<{ summary: string | false; note: string | false; activity_type_id: [number, string] | false; res_id: number }>>("mail.activity", "search_read", [[["res_model", "=", "res.partner"], ["res_id", "in", partnerIds]]], { fields: ["summary", "note", "activity_type_id", "res_id"], limit: 20000 }).catch(() => []);
      openOdooActivities = open.filter((a) => mentions(`${a.summary || ""} ${stripHtml(a.note || "")}`, keywords)).length;
    }
  }
  const partnerMsgs = partnerRaw.map((m) => ({ res_id: m.res_id, date: m.date, body: m.body || "", subject: m.subject || "", message_type: m.message_type, activityType: m.mail_activity_type_id ? m.mail_activity_type_id[1] : null }))
    .filter((m) => m.activityType || m.message_type !== "notification");
  const fromPartners = partnerEntries(partnerMsgs, tasks, keywords);

  const plan = planResync(tasks, (tRes.data ?? []) as IrTask[], (mRes.data ?? []) as IrMatch[], existing, messages, fromPartners.byTask, unattributed);

  const counts: ResyncCounts = { email: 0, call: 0, voicemail: 0, meeting: 0, term_sheet: 0, document: 0 };
  for (const a of plan.add) if (a.type in counts) counts[a.type as keyof ResyncCounts]++;
  const result: ResyncResult = {
    projectId, dryRun, odooTasks: tasks.length, tasksWithNotes: plan.tasksWithNotes, entries: plan.entries, chatterMessages: messages.length, chatterEntries: plan.chatterEntries,
    toAdd: { ...counts, total: plan.add.length, onInvestor: plan.add.filter((a) => a.matchId).length, onTask: plan.add.filter((a) => !a.matchId).length },
    partnerMessages: fromPartners.matched, partnerEntries: plan.partnerEntries, openOdooActivities, keywords,
    alreadyPresent: plan.already, skippedUndated: plan.undated, skippedNotes: plan.notes, tasksNotImported: plan.notImported,
    stagesAdvanced: plan.stageMoves.length, movedToInvestor: plan.attach.length,
    sample: plan.add.slice(0, 12).map((a) => ({ date: a.date, type: a.type, outcome: a.outcome.slice(0, 120), investor: a.investor })),
  };
  if (dryRun || (!plan.add.length && !plan.attach.length && !plan.stageMoves.length)) return result;

  for (const t of plan.attach) {
    const { error } = await db().from("ir_activities").update({ match_id: t.matchId, outcome: t.outcome }).eq("id", t.id).is("match_id", null);
    if (error) throw new Error(`Couldn't move an activity onto its investor: ${error.message}`);
  }

  for (let i = 0; i < plan.add.length; i += 500) {
    const rows = plan.add.slice(i, i + 500).map((a) => ({
      project_id: projectId, match_id: a.matchId, task_id: a.taskId, type: a.type, subject: a.subject, outcome: a.outcome,
      done_at: `${a.date}T12:00:00Z`, created_at: `${a.date}T12:00:00Z`, assignee_id: a.assigneeId ?? by, created_by: by, founder_visible: true,
    }));
    const { error } = await db().from("ir_activities").insert(rows);
    if (error) throw new Error(`Couldn't add activities: ${error.message}`);
  }
  for (const s of plan.stageMoves) await updateMatch(s.matchId, { stage: s.to }, by);
  return result;
}
