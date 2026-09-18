/**
 * One-click Odoo → IR Hub import for one founder (company). No choices: every
 * mapping the wizard used to ask for is decided here from the Odoo data.
 *   project      one per founder group; reused when any of its Odoo projects was imported before
 *   founder link Sales Hub contact / company by name, else a founder contact is created
 *   term         number of Odoo months, clamped to the 4–6 the schema allows
 *   start date   earliest task / activity date, else the Odoo project start, else today
 *   owner        Odoo project owner resolved to staff, else the importing user
 *   investors    every contact field on the task (Matches / Contact / Meetings…), stage from the field
 *   activities   Agent Field text parsed and dated; all approved
 *   re-runs      additive — executeImport skips what is already there
 * Investors with no Investor Contact are reported back; `createMissing` creates them first.
 */
import { db } from "@/lib/ir/db";
import { discover, executeImport, inferStage, matchInvestorTags, odooProjects, odooTasks, staffByName, taskEntries, type ImportPlan, type ImportResult, type PlanTask } from "@/lib/ir/odoo-import";
import { parseTag, type ProjectGroup } from "@/lib/ir/odoo-parse";
import { IR_STAGES, type IrStage } from "@/lib/ir/types";

export type AutoCompany = { key: string; name: string; months: number; tasks: number; agent: string | null; projectId: string | null };
export type MissingInvestor = { tag: string; name: string | null; firm: string | null; email: string | null; ambiguous: boolean };
export type AutoResult = ImportResult & { company: string; missing: MissingInvestor[]; founderCreated: boolean };

export async function autoCompanies(): Promise<{ configured: boolean; companies: AutoCompany[] }> {
  const d = await discover();
  if (!d.configured) return { configured: false, companies: [] };
  const { groups, imported } = await odooProjects(d);
  return {
    configured: true,
    companies: groups.map((g) => ({ key: g.key, name: g.founder, months: g.projects.length, tasks: g.projects.reduce((n, p) => n + p.taskCount, 0), agent: g.projects[0]?.userName ?? null, projectId: g.projects.map((p) => imported.get(p.id)).find(Boolean) ?? null })),
  };
}

const rank = (s: IrStage) => IR_STAGES.indexOf(s);
const SOURCE = "odoo-ir";

async function linkFounder(group: ProjectGroup): Promise<{ founderContactId: string | null; companyId: string | null; created: boolean }> {
  const like = `%${group.founder.replace(/[%_,]/g, " ").trim()}%`;
  const [c, co] = await Promise.all([
    db().from("crm_contacts").select("id, contact_type").or(`name.ilike.${like},company.ilike.${like}`).order("contact_type", { ascending: true }).limit(10),
    db().from("companies").select("id").ilike("company_name", like).limit(1),
  ]);
  const contacts = (c.data ?? []) as Array<{ id: string; contact_type: string | null }>;
  const founder = contacts.find((x) => x.contact_type === "founder") ?? contacts[0];
  const company = ((co.data ?? []) as Array<{ id: string }>)[0];
  if (company) return { founderContactId: founder?.id ?? null, companyId: company.id, created: false };
  if (founder) return { founderContactId: founder.id, companyId: null, created: false };
  const { data, error } = await db().from("crm_contacts").upsert({ source: SOURCE, external_id: `founder:${group.key}`, module: "founder", name: group.founder, company: group.founder, synced_at: new Date().toISOString() }, { onConflict: "source,external_id" }).select("id").single();
  if (error) throw new Error(`Couldn't create the founder contact: ${error.message}`);
  return { founderContactId: (data as { id: string }).id, companyId: null, created: true };
}

async function createInvestors(tags: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const tag of tags) {
    const p = parseTag(tag);
    const { data, error } = await db().from("crm_contacts").upsert({ source: SOURCE, external_id: `investor:${tag}`, module: "investor", name: p.name ?? tag, email: p.email, company: p.firm, synced_at: new Date().toISOString() }, { onConflict: "source,external_id" }).select("id").single();
    if (error) throw new Error(`Couldn't create investor "${tag}": ${error.message}`);
    out.set(tag, (data as { id: string }).id);
  }
  return out;
}

export async function autoImport(groupKey: string, by: string, opts: { createMissing?: boolean } = {}): Promise<AutoResult> {
  const d = await discover();
  if (!d.configured) throw new Error("Odoo isn't configured on this environment.");
  const { groups, imported } = await odooProjects(d);
  const group = groups.find((g) => g.key === groupKey);
  if (!group) throw new Error("That company is no longer in Odoo.");
  const odooIds = group.projects.map((p) => p.id);
  const tasks = await odooTasks(odooIds, d, d.agentField);
  const { resolve } = await staffByName();
  const resolutions = await matchInvestorTags(tasks.flatMap((t) => t.tags.map((g) => g.name)));

  // Investor tag → contact. Exact/email/name matches count; ambiguous ones are left for a human unless createMissing.
  const contactByTag = new Map<string, string>();
  const missing: MissingInvestor[] = [];
  for (const r of resolutions) {
    if (r.status === "matched" && r.contactId) contactByTag.set(r.tag, r.contactId);
    else missing.push({ tag: r.tag, name: r.parsed.name, firm: r.parsed.firm, email: r.parsed.email, ambiguous: r.status === "ambiguous" });
  }
  if (opts.createMissing && missing.length) {
    const made = await createInvestors(missing.map((m) => m.tag));
    for (const [tag, id] of made) contactByTag.set(tag, id);
    missing.length = 0;
  }

  // Dates: earliest task create date or activity date drives the project start.
  const monthOf = new Map(group.projects.map((p, i) => [p.id, p.month ?? i + 1]));
  const dates: string[] = [];
  const planTasks: PlanTask[] = tasks.map((t) => {
    const entries = taskEntries(t);
    if (t.createDate) dates.push(t.createDate.slice(0, 10));
    for (const e of entries) if (e.date) dates.push(e.date);
    return {
      odooId: t.id, title: t.name, month: monthOf.get(t.projectId) ?? t.month ?? 1, week: t.week, assigneeId: resolve(t.assignee),
      investors: t.tags.flatMap((g) => {
        const contactId = contactByTag.get(g.name); if (!contactId) return [];
        const mine = entries.filter((e) => e.investorKey === g.name && e.date);
        const fromEntries = inferStage(mine);
        return [{ tag: g.name, contactId, stage: rank(fromEntries) > rank(g.stage) ? fromEntries : g.stage, activities: mine.map((e) => ({ type: e.type, subject: e.subject, outcome: e.outcome, date: e.date as string, assigneeId: null })) }];
      }),
    };
  });

  const existingId = group.projects.map((p) => imported.get(p.id)).find(Boolean) ?? null;
  let founderCreated = false;
  let target: ImportPlan["target"];
  if (existingId) target = { projectId: existingId };
  else {
    const link = await linkFounder(group); founderCreated = link.created;
    const startDate = dates.sort()[0] ?? group.projects.map((p) => p.dateStart).filter(Boolean).sort()[0] ?? new Date().toISOString().slice(0, 10);
    const owner = resolve(group.projects[0]?.userName ?? null) ?? by;
    target = { create: { title: group.founder, founderName: group.founder, ownerId: owner, startDate, termMonths: Math.max(4, Math.min(6, group.projects.length)), founderContactId: link.founderContactId, companyId: link.companyId } };
  }

  const result = await executeImport({ target, odooProjectIds: odooIds, tasks: planTasks }, by);
  return { ...result, company: group.founder, missing, founderCreated };
}
