/**
 * Odoo Deals2Match → IR Hub import — server only. Odoo stays read-only: this module
 * only calls search_read / fields_get. Reads produce proposals (grouped projects,
 * investor tag matches, parsed Agent Field activities); staff review in the wizard and
 * the executor writes exactly the approved plan. Re-running is safe: projects, tasks
 * and matches already imported (odoo_* trace columns) are skipped.
 */
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";
import { createProject, createTask, db, getProject, listMilestones, listStaff, updateMatch } from "@/lib/ir/db";
import { attributeEntries, groupProjects, monthIndex, parseAgentField, parseTag, stripHtml, weekIndex, inferStage, type OdooProjectLite, type ParsedEntry, type ParsedTag, type ProjectGroup } from "@/lib/ir/odoo-parse";
import { IR_STAGES, type IrActivityType, type IrStage } from "@/lib/ir/types";

type Many2one = [number, string] | false;
const m2oName = (v: Many2one) => (v ? v[1] : null);
const m2oId = (v: Many2one) => (v ? v[0] : null);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

// ── Discovery ────────────────────────────────────────────────────────────────
export type OdooField = { name: string; label: string; type: string; relation: string | null };
export type Discovery = { configured: boolean; agentField: string | null; investorField: string; customFields: OdooField[]; hasUserIds: boolean; hasTaskCount: boolean; hasPartner: boolean };

export async function discover(): Promise<Discovery> {
  if (!odooConfigured()) return { configured: false, agentField: null, investorField: "tag_ids", customFields: [], hasUserIds: false, hasTaskCount: false, hasPartner: false };
  const fields = await executeKw<Record<string, { string: string; type: string; relation?: string }>>("project.task", "fields_get", [], { attributes: ["string", "type", "relation"] });
  const custom = Object.entries(fields).filter(([k]) => k.startsWith("x_")).map(([name, f]) => ({ name, label: f.string, type: f.type, relation: f.relation ?? null }));
  const textish = custom.filter((f) => ["text", "html", "char"].includes(f.type));
  const agent = process.env.ODOO_IR_AGENT_FIELD?.trim() || textish.find((f) => /agent/i.test(f.label))?.name || textish.find((f) => /note|activity|log|update/i.test(f.label))?.name || textish[0]?.name || null;
  // Investors on a task: a Studio many2many to contacts labelled "investor" wins; else Odoo tags.
  const relInv = custom.find((f) => (f.type === "many2many" || f.type === "one2many") && f.relation === "res.partner" && /investor|contact|partner/i.test(f.label)) ?? custom.find((f) => f.type === "many2many" && f.relation === "res.partner");
  const investorField = process.env.ODOO_IR_INVESTOR_FIELD?.trim() || relInv?.name || "tag_ids";
  const projFields = await executeKw<Record<string, unknown>>("project.project", "fields_get", [], { attributes: ["type"] });
  return { configured: true, agentField: agent, investorField, customFields: custom, hasUserIds: "user_ids" in fields, hasTaskCount: "task_count" in projFields, hasPartner: "partner_id" in fields };
}

// ── Projects ─────────────────────────────────────────────────────────────────
export async function odooProjects(d: Discovery): Promise<{ groups: ProjectGroup[]; imported: Map<number, string> }> {
  const fields = ["id", "name", "date_start", "user_id", ...(d.hasTaskCount ? ["task_count"] : [])];
  const rows = await executeKw<Array<{ id: number; name: string; date_start: string | false; user_id: Many2one; task_count?: number }>>("project.project", "search_read", [[]], { fields, limit: 500, order: "name asc" });
  const lite: OdooProjectLite[] = rows.map((r) => ({ id: r.id, name: r.name, taskCount: r.task_count ?? 0, dateStart: r.date_start || null, userName: m2oName(r.user_id) }));
  const { data } = await db().from("ir_projects").select("id, odoo_project_ids").not("odoo_project_ids", "is", null);
  const imported = new Map<number, string>();
  for (const p of (data ?? []) as Array<{ id: string; odoo_project_ids: number[] | null }>) for (const oid of p.odoo_project_ids ?? []) imported.set(oid, p.id);
  return { groups: groupProjects(lite), imported };
}

// ── Tasks + tags + Agent Field ───────────────────────────────────────────────
export type OdooTaskLite = {
  id: number; name: string; projectId: number; projectName: string; month: number | null; week: number | null;
  assignee: string | null; createDate: string; deadline: string | null; stageName: string | null;
  tags: Array<{ id: number; name: string }>; agentText: string; alreadyImported: boolean;
};

export async function odooTasks(projectIds: number[], d: Discovery, agentField: string | null, investorField: string = d.investorField): Promise<OdooTaskLite[]> {
  if (!projectIds.length) return [];
  const invField = investorField || "tag_ids";
  const fields = [...new Set(["id", "name", "project_id", invField, "date_deadline", "create_date", "stage_id", d.hasUserIds ? "user_ids" : "user_id", ...(agentField && agentField !== "description" ? [agentField] : []), "description"])];
  const rows = await executeKw<Array<Record<string, unknown>>>("project.task", "search_read", [[["project_id", "in", projectIds]]], { fields, limit: 2000, order: "project_id asc, create_date asc" });
  // Investor ids per task: many2many gives number[]; many2one gives [id, name] | false.
  const invIds = (r: Record<string, unknown>): number[] => { const v = r[invField]; return Array.isArray(v) ? (typeof v[0] === "number" && v.length === 2 && typeof v[1] === "string" ? [v[0] as number] : (v as number[])) : []; };
  const allIds = [...new Set(rows.flatMap(invIds))];
  const relation = invField === "tag_ids" ? "project.tags" : invField === "partner_id" ? "res.partner" : d.customFields.find((f) => f.name === invField)?.relation ?? "project.tags";
  const tagName = new Map<number, string>();
  if (allIds.length) {
    if (relation === "res.partner") {
      const partners = await executeKw<Array<{ id: number; name: string; email: string | false; parent_id: Many2one; company_name?: string | false }>>("res.partner", "read", [allIds, ["name", "email", "parent_id", "company_name"]]);
      for (const p of partners) { const firm = m2oName(p.parent_id) ?? (p.company_name || null); tagName.set(p.id, `${p.name}${firm ? ` (${firm})` : ""}${p.email ? ` ${p.email}` : ""}`); }
    } else {
      const tags = await executeKw<Array<{ id: number; name: string }>>(relation, "read", [allIds, ["name"]]);
      for (const t of tags) tagName.set(t.id, t.name);
    }
  }
  const userIds = [...new Set(rows.flatMap((r) => (d.hasUserIds ? ((r.user_ids as number[]) ?? []) : [])))];
  const users = userIds.length ? await executeKw<Array<{ id: number; name: string }>>("res.users", "read", [userIds, ["name"]]) : [];
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const { data } = await db().from("ir_tasks").select("odoo_task_id").in("odoo_task_id", rows.map((r) => r.id as number));
  const done = new Set(((data ?? []) as Array<{ odoo_task_id: number }>).map((r) => r.odoo_task_id));
  return rows.map((r) => {
    const raw = agentField ? r[agentField] : null;
    const text = typeof raw === "string" && raw.trim() ? raw : "";
    const projName = m2oName(r.project_id as Many2one) ?? "";
    return {
      id: r.id as number, name: String(r.name ?? ""), projectId: m2oId(r.project_id as Many2one) ?? 0, projectName: projName,
      month: monthIndex(projName), week: weekIndex(String(r.name ?? "")),
      assignee: d.hasUserIds ? (((r.user_ids as number[]) ?? []).map((id) => userName.get(id)).filter(Boolean)[0] ?? null) : m2oName(r.user_id as Many2one),
      createDate: String(r.create_date ?? ""), deadline: (r.date_deadline as string | false) || null, stageName: m2oName(r.stage_id as Many2one),
      tags: invIds(r).map((id) => ({ id, name: tagName.get(id) ?? `Tag ${id}` })),
      agentText: stripHtml(text), alreadyImported: done.has(r.id as number),
    };
  });
}

// ── Investor matching (never creates contacts) ──────────────────────────────
export type Candidate = { id: string; name: string | null; firm: string | null; dataSource: string | null };
export type TagResolution = { tag: string; parsed: ParsedTag; status: "matched" | "ambiguous" | "missing"; by: "email" | "name and firm" | "name" | "firm" | null; contactId: string | null; candidates: Candidate[] };

export async function matchInvestorTags(tagNames: string[]): Promise<TagResolution[]> {
  const out: TagResolution[] = [];
  const cols = "id, name, company, inv_source";
  const toC = (rows: unknown[]): Candidate[] => (rows as Array<{ id: string; name: string | null; company: string | null; inv_source: string | null }>).map((r) => ({ id: r.id, name: r.name, firm: r.company, dataSource: r.inv_source }));
  for (const tag of [...new Set(tagNames)]) {
    const parsed = parseTag(tag);
    let by: TagResolution["by"] = null; let cands: Candidate[] = [];
    if (parsed.email) { const { data } = await db().from("crm_contacts").select(cols).ilike("email", parsed.email).limit(5); cands = toC(data ?? []); if (cands.length) by = "email"; }
    if (!cands.length && parsed.name) {
      const like = `%${parsed.name.replace(/[%_,]/g, " ").trim()}%`;
      const { data } = await db().from("crm_contacts").select(cols).eq("contact_type", "investor").ilike("name", like).limit(20);
      cands = toC(data ?? []);
      if (cands.length > 1 && parsed.firm) { const f = norm(parsed.firm).slice(0, 8); const narrowed = cands.filter((c) => norm(c.firm ?? "").includes(f)); if (narrowed.length) { cands = narrowed; by = "name and firm"; } }
      if (cands.length && !by) by = parsed.firm && cands.length === 1 && norm(cands[0].firm ?? "").includes(norm(parsed.firm).slice(0, 8)) ? "name and firm" : "name";
    }
    if (!cands.length && parsed.firm) {
      const like = `%${parsed.firm.replace(/[%_,]/g, " ").trim()}%`;
      const { data } = await db().from("crm_contacts").select(cols).eq("contact_type", "investor").ilike("company", like).limit(20);
      cands = toC(data ?? []); if (cands.length) by = "firm";
    }
    out.push({ tag, parsed, status: cands.length === 1 ? "matched" : cands.length > 1 ? "ambiguous" : "missing", by: cands.length ? by : null, contactId: cands.length === 1 ? cands[0].id : null, candidates: cands.slice(0, 10) });
  }
  return out;
}

/** Odoo user names → iCapOS staff ids, by name. */
export async function staffByName(): Promise<{ staff: Array<{ id: string; name: string }>; resolve: (odooName: string | null) => string | null }> {
  const staff = await listStaff();
  const byNorm = new Map(staff.map((s) => [norm(s.name), s.id]));
  return { staff, resolve: (n) => { if (!n) return null; const k = norm(n); return byNorm.get(k) ?? staff.find((s) => norm(s.name).startsWith(k.split(/\s/)[0] ?? "") && k.length > 3)?.id ?? null; } };
}

/** Parse + attribute one task's Agent Field against its tags (tag names are the keys). */
export function taskEntries(t: OdooTaskLite): Array<ParsedEntry & { investorKey: string | null }> {
  const inv = t.tags.map((g) => { const p = parseTag(g.name); return { key: g.name, name: p.name, firm: p.firm }; });
  return attributeEntries(parseAgentField(t.agentText), inv);
}

// ── Execute the approved plan ───────────────────────────────────────────────
export type PlanActivity = { type: IrActivityType; subject: string; outcome: string; date: string; assigneeId: string | null };
export type PlanInvestor = { tag: string; contactId: string; stage: IrStage; activities: PlanActivity[] };
export type PlanTask = { odooId: number; title: string; month: number; week: number | null; assigneeId: string | null; investors: PlanInvestor[] };
export type ImportPlan = {
  target: { projectId: string } | { create: { title: string; founderName: string | null; ownerId: string; startDate: string; termMonths: number; founderContactId: string | null; companyId: string | null } };
  odooProjectIds: number[];
  tasks: PlanTask[];
};
export type ImportResult = { projectId: string; created: boolean; tasksCreated: number; tasksSkipped: number; matchesCreated: number; matchesReused: number; activitiesCreated: number; stagesSet: number; warnings: string[] };

export async function executeImport(plan: ImportPlan, by: string): Promise<ImportResult> {
  const warnings: string[] = [];
  let projectId: string; let created = false;
  if ("projectId" in plan.target) { const p = await getProject(plan.target.projectId); if (!p) throw new Error("Target project not found."); projectId = p.id; }
  else { const c = plan.target.create; projectId = (await createProject({ companyId: c.companyId, title: c.title, founderName: c.founderName, founderContactId: c.founderContactId, ownerId: c.ownerId, sourceOpportunityId: null, startDate: c.startDate, termMonths: c.termMonths, founderReportVisible: true, isSpv: false, createdBy: by })).id; created = true; }
  const client = db();
  const { data: cur } = await client.from("ir_projects").select("odoo_project_ids, term_months").eq("id", projectId).single();
  const existingIds = ((cur as { odoo_project_ids: number[] | null } | null)?.odoo_project_ids ?? []);
  const term = (cur as { term_months: number } | null)?.term_months ?? 6;
  await client.from("ir_projects").update({ odoo_project_ids: [...new Set([...existingIds, ...plan.odooProjectIds])] }).eq("id", projectId);

  const milestones = await listMilestones(projectId);
  const months = milestones.filter((m) => m.kind === "month"), weeks = milestones.filter((m) => m.kind === "week");
  const monthFor = (n: number) => months.find((m) => m.sort_order === Math.min(Math.max(1, n), term)) ?? months[0];
  const weekFor = (monthN: number, weekN: number | null) => {
    const mo = monthFor(monthN);
    const w = weekN != null ? weeks.find((x) => x.sort_order === weekN && x.parent_id === mo.id) ?? weeks.find((x) => x.sort_order === weekN) : null;
    return w ?? weeks.find((x) => x.parent_id === mo.id) ?? weeks[0];
  };
  const stageRank = (s: IrStage) => IR_STAGES.indexOf(s);

  const { data: doneRows } = await client.from("ir_tasks").select("id, odoo_task_id").eq("project_id", projectId).not("odoo_task_id", "is", null);
  const doneTasks = new Map(((doneRows ?? []) as Array<{ id: string; odoo_task_id: number }>).map((r) => [r.odoo_task_id, r.id]));
  const { data: matchRows } = await client.from("ir_matches").select("id, investor_contact_id, stage").eq("project_id", projectId);
  const matchByContact = new Map(((matchRows ?? []) as Array<{ id: string; investor_contact_id: string; stage: IrStage }>).map((m) => [m.investor_contact_id, m]));

  const r: ImportResult = { projectId, created, tasksCreated: 0, tasksSkipped: 0, matchesCreated: 0, matchesReused: 0, activitiesCreated: 0, stagesSet: 0, warnings };
  const sorted = [...plan.tasks].sort((a, b) => a.month - b.month || (a.week ?? 0) - (b.week ?? 0) || a.odooId - b.odooId);
  for (const t of sorted) {
    const mo = monthFor(t.month), wk = weekFor(t.month, t.week);
    if (!mo || !wk) { warnings.push(`Task "${t.title}": no milestone for month ${t.month}; skipped.`); r.tasksSkipped++; continue; }
    // Re-runs are additive: an already-imported task keeps its row and only gains investors not yet matched on the project.
    const doneId = doneTasks.get(t.odooId);
    let task: { id: string };
    if (doneId) { task = { id: doneId }; r.tasksSkipped++; }
    else {
      task = await createTask({ projectId, milestoneId: wk.id, title: t.title, assigneeId: t.assigneeId });
      await client.from("ir_tasks").update({ odoo_task_id: t.odooId, created_at: earliest(t) ?? undefined }).eq("id", task.id);
      r.tasksCreated++;
    }
    for (const inv of t.investors) {
      if (doneId && matchByContact.has(inv.contactId)) continue;
      let match = matchByContact.get(inv.contactId); let firstOn = false;
      if (!match) {
        const { data: src } = await client.from("crm_contacts").select("inv_source").eq("id", inv.contactId).maybeSingle();
        const { data: ins, error } = await client.from("ir_matches").insert({ project_id: projectId, investor_contact_id: inv.contactId, task_id: task.id, milestone_id: mo.id, assignee_id: t.assigneeId, odoo_tag: inv.tag, data_source: (src as { inv_source: string | null } | null)?.inv_source ?? null, created_by: by }).select("id, investor_contact_id, stage").single();
        if (error) { warnings.push(`${inv.tag}: ${error.message}`); continue; }
        match = ins as { id: string; investor_contact_id: string; stage: IrStage }; matchByContact.set(inv.contactId, match); r.matchesCreated++; firstOn = true;
      } else r.matchesReused++;
      const dates = inv.activities.map((a) => a.date).filter(Boolean).sort();
      if (firstOn) { const first = dates[0] ?? earliest(t); if (first) await client.from("ir_match_stage_events").update({ changed_at: `${first}T12:00:00Z`, changed_by: by }).eq("match_id", match.id).is("from_stage", null); }
      if (inv.activities.length) {
        const { error } = await client.from("ir_activities").insert(inv.activities.map((a) => ({ project_id: projectId, match_id: match!.id, task_id: task.id, type: a.type, subject: a.subject, outcome: a.outcome, done_at: `${a.date}T12:00:00Z`, assignee_id: a.assigneeId ?? t.assigneeId, created_by: by, founder_visible: true })));
        if (error) warnings.push(`${inv.tag} activities: ${error.message}`); else r.activitiesCreated += inv.activities.length;
      }
      if (stageRank(inv.stage) > stageRank(match.stage)) {
        await updateMatch(match.id, { stage: inv.stage, task_id: match.stage === "matched" && firstOn ? task.id : undefined }, by);
        const last = dates[dates.length - 1];
        if (last) await client.from("ir_match_stage_events").update({ changed_at: `${last}T12:00:00Z` }).eq("match_id", match.id).eq("to_stage", inv.stage);
        match.stage = inv.stage; r.stagesSet++;
      }
    }
  }
  return r;
}
function earliest(t: PlanTask): string | null {
  const all = t.investors.flatMap((i) => i.activities.map((a) => a.date)).filter(Boolean).sort();
  return all[0] ?? null;
}
export { inferStage };
