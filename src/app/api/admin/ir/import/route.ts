/**
 * Odoo → IR Hub import wizard API. Odoo is read-only here.
 *   GET                                     → { configured, discovery, groups, imported, projects, staff }
 *   POST { action: "tasks", projectIds, agentField?, investorField? } → { tasks: [{ …task, entries, stage }], resolutions: TagResolution[] }
 *   POST { action: "founders", q }           → { contacts, companies }  founder link for a new project (no phone / email returned)
 *   POST { action: "execute", plan }        → ImportResult
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db, listProjects } from "@/lib/ir/db";
import { discover, executeImport, inferStage, matchInvestorTags, odooProjects, odooTasks, staffByName, taskEntries } from "@/lib/ir/odoo-import";
import { IR_ACTIVITY_TYPES, IR_STAGES } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  try {
    const d = await discover();
    if (!d.configured) return NextResponse.json({ configured: false, discovery: d, groups: [], imported: {}, projects: [], staff: [] });
    const [{ groups, imported }, projects, { staff }] = await Promise.all([odooProjects(d), listProjects({}), staffByName()]);
    return NextResponse.json({ configured: true, discovery: d, groups, imported: Object.fromEntries(imported), projects: projects.map((p) => ({ id: p.id, title: p.title, founder_name: p.founder_name, status: p.status, start_date: p.start_date, term_months: p.term_months })), staff });
  } catch (e) { return failed(e, "Couldn't read from Odoo."); }
}

const tasksSchema = z.object({ action: z.literal("tasks"), projectIds: z.array(z.number().int()).min(1).max(50), agentField: z.string().max(120).nullish(), investorField: z.string().max(120).nullish() });
const foundersSchema = z.object({ action: z.literal("founders"), q: z.string().max(120) });
const activity = z.object({ type: z.enum(IR_ACTIVITY_TYPES), subject: z.string().min(1).max(200), outcome: z.string().max(2000), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), assigneeId: z.string().uuid().nullable() });
const planSchema = z.object({
  action: z.literal("execute"),
  plan: z.object({
    target: z.union([
      z.object({ projectId: z.string().uuid() }),
      z.object({ create: z.object({ title: z.string().min(1).max(160), founderName: z.string().max(160).nullable(), ownerId: z.string().uuid(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), termMonths: z.number().int().min(1).max(12), founderContactId: z.string().uuid().nullable(), companyId: z.string().uuid().nullable() }) }),
    ]),
    odooProjectIds: z.array(z.number().int()).min(1),
    tasks: z.array(z.object({
      odooId: z.number().int(), title: z.string().min(1).max(200), month: z.number().int().min(1).max(12), week: z.number().int().min(1).max(48).nullable(), assigneeId: z.string().uuid().nullable(),
      investors: z.array(z.object({ tag: z.string().max(300), contactId: z.string().uuid(), stage: z.enum(IR_STAGES), activities: z.array(activity).max(200) })).max(200),
    })).max(500),
  }),
});

export async function POST(req: NextRequest): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action === "tasks") {
      const p = tasksSchema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: "Pick at least one Odoo project." }, { status: 400 });
      const d = await discover();
      if (!d.configured) return NextResponse.json({ error: "Odoo isn't configured on this environment." }, { status: 503 });
      const agentField = p.data.agentField === undefined ? d.agentField : p.data.agentField || null;
      const investorField = p.data.investorField || d.investorField;
      const tasks = await odooTasks(p.data.projectIds, d, agentField, investorField);
      const { resolve } = await staffByName();
      const resolutions = await matchInvestorTags(tasks.flatMap((t) => t.tags.map((g) => g.name)));
      return NextResponse.json({
        agentField, investorField,
        tasks: tasks.map((t) => { const entries = taskEntries(t); return { ...t, assigneeId: resolve(t.assignee), entries, stages: Object.fromEntries(t.tags.map((g) => [g.name, inferStage(entries.filter((e) => e.investorKey === g.name))])) }; }),
        resolutions,
      });
    }
    if (body?.action === "founders") {
      const p = foundersSchema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: "Invalid search." }, { status: 400 });
      const q = p.data.q.trim(); if (q.length < 2) return NextResponse.json({ contacts: [], companies: [] });
      const like = `%${q.replace(/[%_,]/g, " ")}%`;
      const [c, co] = await Promise.all([
        db().from("crm_contacts").select("id, name, company, contact_type").or(`name.ilike.${like},company.ilike.${like}`).order("name").limit(20),
        db().from("companies").select("id, company_name").ilike("company_name", like).order("company_name").limit(20),
      ]);
      return NextResponse.json({ contacts: (c.data ?? []) as Array<{ id: string; name: string | null; company: string | null; contact_type: string | null }>, companies: (co.data ?? []) as Array<{ id: string; company_name: string }> });
    }
    if (body?.action === "execute") {
      const p = planSchema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Invalid plan." }, { status: 400 });
      const result = await executeImport(p.data.plan, me.id);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return failed(e, "Import step failed."); }
}
