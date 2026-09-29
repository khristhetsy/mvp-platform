/**
 * Project record (the Odoo-style form opened from a Projects card).
 *   GET  → { project, milestones, counts, entrepreneur, staff, siblings, followers, analytics, feed }
 *   POST { action: "message", body } → { notified }     chatter message to followers (owner + task assignees)
 *   POST { action: "note", body }    → { ok }           log note on the project
 * Field updates go through PATCH /api/admin/ir/projects/[id].
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createNote, db, entrepreneurProfile, getProject, listActivities, listMatches, listMilestones, listNotes, listProjects, listStaff, listTasks, nameMap } from "@/lib/ir/db";
import { loadActivities, loadEvents, loadMatches } from "@/lib/ir/dashboard";
import { MESSAGE_PREFIX, sendRecordMessage } from "@/lib/ir/messages";
import { countMetrics, periodFor, type MetricCounts } from "@/lib/ir/metrics";
import { IR_STAGE_LABEL, type IrStage } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

export type FeedItem = { at: string; who: string; kind: "message" | "note" | "activity" | "stage" | "report" | "system"; text: string; href?: string };
export type ProjectFormAnalytics = { week: MetricCounts; month: MetricCounts; term: MetricCounts };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const today = new Date().toISOString().slice(0, 10);
    const [milestones, matches, tasks, activities, notes, staff, entrepreneur, all, reports, lite, events] = await Promise.all([
      listMilestones(id), listMatches(id), listTasks(id), listActivities({ projectId: id }), listNotes({ projectId: id }), listStaff(), entrepreneurProfile(project), listProjects({}),
      db().from("ir_reports").select("id, period_kind, period_start, period_end, sent_to, sent_at, created_by").eq("project_id", id).not("sent_at", "is", null).order("sent_at", { ascending: false }),
      loadActivities([id], project.start_date), loadEvents([id]),
    ]);
    const sent = (reports.data ?? []) as Array<{ id: string; period_kind: string; period_start: string; period_end: string; sent_to: string | null; sent_at: string; created_by: string }>;
    const matchLite = await loadMatches([id]);
    const names = await nameMap([...activities.map((a) => a.created_by), ...notes.map((n) => n.created_by), ...sent.map((r) => r.created_by), project.owner_id]);
    const who = (uid: string | null | undefined) => (uid && names.get(uid)) || "iCapOS";
    const investor = new Map(matches.map((m) => [m.id, m.investor_name ?? m.investor_firm ?? "Investor"]));

    const feed: FeedItem[] = [];
    for (const n of notes) {
      const msg = n.body.startsWith(MESSAGE_PREFIX);
      feed.push({ at: n.created_at, who: who(n.created_by), kind: msg ? "message" : "note", text: msg ? n.body.slice(MESSAGE_PREFIX.length) : n.body, href: n.match_id ? `/admin/ir/matches/${n.match_id}` : undefined });
    }
    for (const a of activities) {
      if (!a.done_at) continue;
      const inv = a.match_id ? investor.get(a.match_id) : null;
      feed.push({ at: a.done_at, who: who(a.assignee_id ?? a.created_by), kind: "activity", text: `${a.subject}${inv ? ` · ${inv}` : ""}${a.outcome ? ` — ${a.outcome}` : ""}`, href: a.match_id ? `/admin/ir/matches/${a.match_id}` : undefined });
    }
    const { data: ev } = await db().from("ir_match_stage_events").select("match_id, from_stage, to_stage, changed_at, changed_by").in("match_id", matches.map((m) => m.id)).order("changed_at", { ascending: false }).limit(200);
    for (const e of (ev ?? []) as Array<{ match_id: string; from_stage: IrStage | null; to_stage: IrStage; changed_at: string; changed_by: string | null }>) {
      if (!e.from_stage) continue;
      feed.push({ at: e.changed_at, who: who(e.changed_by), kind: "stage", text: `${investor.get(e.match_id) ?? "Investor"}: ${IR_STAGE_LABEL[e.from_stage]} → ${IR_STAGE_LABEL[e.to_stage]}`, href: `/admin/ir/matches/${e.match_id}` });
    }
    for (const r of sent) feed.push({ at: r.sent_at, who: who(r.created_by), kind: "report", text: `Founder report sent · ${r.period_kind} ${r.period_start} → ${r.period_end}${r.sent_to ? ` · ${r.sent_to}` : ""}`, href: `/admin/ir/projects/${id}/report` });
    feed.push({ at: project.created_at, who: who(project.owner_id), kind: "system", text: "Project created" });
    feed.sort((a, b) => (a.at < b.at ? 1 : -1));

    const idx = all.findIndex((p) => p.id === id);
    const m = (p: { start: string; end: string }) => countMetrics(lite, matchLite, events, p);
    const analytics: ProjectFormAnalytics = { week: m(periodFor("week", today)), month: m(periodFor("month", today)), term: m({ start: project.start_date, end: project.end_date }) };
    const followers = [...new Set([project.owner_id, ...tasks.map((t) => t.assignee_id)].filter((x): x is string => Boolean(x)))];
    return NextResponse.json({
      project, milestones, staff, entrepreneur, analytics, followers: followers.map((f) => ({ id: f, name: names.get(f) ?? staff.find((s) => s.id === f)?.name ?? "—" })),
      counts: { tasksTotal: tasks.length, tasksDone: tasks.filter((t) => t.status === "done").length, matches: matches.length, meetingsHeld: activities.filter((a) => a.type === "meeting" && a.done_at).length, lastReport: sent[0] ? { kind: sent[0].period_kind, end: sent[0].period_end, at: sent[0].sent_at } : null },
      siblings: { index: idx, total: all.length, prev: idx > 0 ? all[idx - 1].id : null, next: idx >= 0 && idx < all.length - 1 ? all[idx + 1].id : null },
      feed: feed.slice(0, 150),
    });
  } catch (e) { return failed(e, "Couldn't load the project."); }
}

const postSchema = z.object({ action: z.enum(["message", "note"]), body: z.string().min(1).max(5000) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const { id } = await ctx.params;
  const p = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Write the message." }, { status: 400 });
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (p.data.action === "note") { await createNote({ projectId: id, matchId: null, body: p.data.body.trim(), founderVisible: false, createdBy: me.id }); return NextResponse.json({ ok: true }); }
    const tasks = await listTasks(id);
    const r = await sendRecordMessage({ projectId: id, matchId: null, taskId: null, body: p.data.body, followers: [project.owner_id, ...tasks.map((t) => t.assignee_id)], senderId: me.id, recordLabel: project.title, deepLink: `/admin/ir/projects/${id}` });
    return NextResponse.json(r);
  } catch (e) { return failed(e, "Couldn't post to the project."); }
}
