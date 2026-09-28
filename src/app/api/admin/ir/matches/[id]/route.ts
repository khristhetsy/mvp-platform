/**
 * One investor on one project (Share Project record).
 *   GET   → { match, project, activities, notes, stageEvents, alsoMatched, staff, investor, entrepreneur, siblings }
 *   PATCH { stage?, assigneeId?, starred?, founderVisible?, termSheetReceivedAt?, taskId?, blockers? } → { ok }
 *   POST  { action: "intro_sent", note? }   → marks the intro email sent (to-do done, stage → Intro sent)
 *   POST  { action: "message", body }       → message to followers (owner + assignee), kept on the record
 *   POST  { action: "term_sheet_sent", note? } → logs a done Term sheet activity (counts on the dashboard's Term sheets card)
 *   POST  { action: "send_email", subject, body, via: icapos|gmail, includeOnePager } → emails the investor,
 *         logs a done Email activity (completing the intro to-do) and moves Matched → Intro sent
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { alsoMatched, createActivity, db, entrepreneurProfile, getMatch, getProject, listActivities, listMatches, listNotes, listStaff, listStageEvents, updateActivity, updateMatch } from "@/lib/ir/db";
import { sendRecordMessage } from "@/lib/ir/messages";
import { investorHasEmail, onePagerFor, sendInvestorEmail } from "@/lib/ir/send-email";
import { INTRO_SUBJECT, IR_STAGES, TERM_SHEET_SENT_SUBJECT } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const match = await getMatch(id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    const [project, activities, notes, stageEvents, also, staff, inv] = await Promise.all([
      getProject(match.project_id), listActivities({ matchId: id }), listNotes({ matchId: id }), listStageEvents(id), alsoMatched(match.investor_contact_id, id), listStaff(),
      // Investor profile for the tab — no phone / email here; the Sales Hub contact page enforces its own permissions.
      db().from("crm_contacts").select("id, name, company, country, inv_source, inv_verified_at, profile").eq("id", match.investor_contact_id).maybeSingle(),
    ]);
    const c = (inv.data ?? null) as { id: string; name: string | null; company: string | null; country: string | null; inv_source: string | null; inv_verified_at: string | null; profile: Record<string, unknown> | null } | null;
    const investor = c ? { id: c.id, name: c.name, firm: c.company, country: c.country, dataSource: c.inv_source, verifiedAt: c.inv_verified_at, investorTypes: (c.profile?.investorTypes as string[] | undefined) ?? [], industries: (c.profile?.industries as string[] | undefined) ?? [] } : null;
    const [entrepreneur, all, hasEmail, onePager] = await Promise.all([project ? entrepreneurProfile(project) : null, listMatches(match.project_id), investorHasEmail(match.investor_contact_id), onePagerFor(project?.company_id ?? null)]);
    // Pager order = the pipeline's: stage, then investor name.
    const siblings = all.sort((a, b) => IR_STAGES.indexOf(a.stage) - IR_STAGES.indexOf(b.stage) || (a.investor_name ?? "").localeCompare(b.investor_name ?? "")).map((m) => ({ id: m.id, name: m.investor_name ?? m.investor_firm ?? "Investor" }));
    // `send` says what the composer can do — never the address itself.
    return NextResponse.json({ match, project, activities, notes, stageEvents, alsoMatched: also, staff, investor, entrepreneur, siblings, send: { hasEmail, onePagerUrl: onePager?.url ?? null } });
  } catch (e) { return failed(e, "Couldn't load the record."); }
}

const schema = z.object({
  stage: z.enum(IR_STAGES).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  starred: z.boolean().optional(),
  founderVisible: z.boolean().optional(),
  termSheetReceivedAt: z.string().datetime().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  blockers: z.array(z.object({ label: z.string().min(1).max(160), cleared_at: z.string().datetime().nullable() })).max(50).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await irStaff();
  if (!profile) return forbidden();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const d = parsed.data;
  try {
    await updateMatch(id, { stage: d.stage, assignee_id: d.assigneeId, starred: d.starred, founder_visible: d.founderVisible, term_sheet_received_at: d.termSheetReceivedAt, task_id: d.taskId, blockers: d.blockers }, profile.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't update the record."); }
}

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("intro_sent"), note: z.string().max(1000).nullish() }),
  z.object({ action: z.literal("message"), body: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("term_sheet_sent"), note: z.string().trim().max(1000).nullish() }),
  z.object({ action: z.literal("send_email"), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(8000), via: z.enum(["icapos", "gmail"]), includeOnePager: z.boolean().default(false) }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const { id } = await ctx.params;
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  try {
    const match = await getMatch(id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    const project = await getProject(match.project_id);
    if (parsed.data.action === "intro_sent") {
      const acts = await listActivities({ matchId: id });
      const todo = acts.find((a) => !a.done_at && a.subject === INTRO_SUBJECT);
      const now = new Date().toISOString();
      if (todo) await updateActivity(todo.id, { done_at: now, outcome: parsed.data.note ?? "Intro email sent", assignee_id: todo.assignee_id ?? me.id });
      else await createActivity({ projectId: match.project_id, matchId: id, taskId: match.task_id, type: "email", subject: INTRO_SUBJECT, outcome: parsed.data.note ?? "Intro email sent", doneAt: now, founderVisible: true, assigneeId: me.id, createdBy: me.id });
      if (match.stage === "matched") await updateMatch(id, { stage: "intro_sent" }, me.id);
      return NextResponse.json({ ok: true });
    }
    if (parsed.data.action === "term_sheet_sent") {
      const a = await createActivity({ projectId: match.project_id, matchId: id, taskId: match.task_id, type: "term_sheet", subject: TERM_SHEET_SENT_SUBJECT, outcome: parsed.data.note || "Term sheet sent to the investor", doneAt: new Date().toISOString(), founderVisible: true, assigneeId: me.id, createdBy: me.id });
      return NextResponse.json({ ok: true, activityId: a.id });
    }
    if (parsed.data.action === "send_email") {
      const d = parsed.data;
      const sent = await sendInvestorEmail({ investorContactId: match.investor_contact_id, companyId: project?.company_id ?? null, subject: d.subject, body: d.body, via: d.via, includeOnePager: d.includeOnePager, sender: { id: me.id, email: me.email, name: me.full_name } });
      if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });
      const now = new Date().toISOString();
      const outcome = `Sent with ${d.via === "gmail" ? "Gmail" : "iCapOS"}${sent.onePager ? ", one-pager linked" : ""}`;
      const todo = match.stage === "matched" ? (await listActivities({ matchId: id })).find((a) => !a.done_at && a.subject === INTRO_SUBJECT) : undefined;
      if (todo) await updateActivity(todo.id, { done_at: now, description: `${d.subject}\n\n${d.body}`.slice(0, 4000), outcome, assignee_id: todo.assignee_id ?? me.id });
      else await createActivity({ projectId: match.project_id, matchId: id, taskId: match.task_id, type: "email", subject: d.subject, description: d.body.slice(0, 4000), outcome, doneAt: now, founderVisible: true, assigneeId: me.id, createdBy: me.id });
      if (match.stage === "matched") await updateMatch(id, { stage: "intro_sent" }, me.id);
      return NextResponse.json({ ok: true, via: d.via, onePager: sent.onePager });
    }
    const r = await sendRecordMessage({ projectId: match.project_id, matchId: id, taskId: null, body: parsed.data.body, followers: [project?.owner_id, match.assignee_id], senderId: me.id, recordLabel: `${match.investor_name ?? match.investor_firm ?? "Investor"} · ${project?.title ?? "IR"}`, deepLink: `/admin/ir/matches/${id}` });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return failed(e, "Couldn't complete that."); }
}

/** DELETE → removes the investor from the project (their activities and stage history go with it). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const { error } = await db().from("ir_matches").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't remove the investor."); }
}
