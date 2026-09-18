/**
 * Founder report for one project.
 *   GET  ?kind=week|month|custom&milestone=<id>&start&end&compare=1 → ReportData (+ saved snapshot when one exists)
 *   POST { action: "draft", ...period }                 → { summary, source }          AI drafts; nothing is written
 *   POST { action: "save", ...period, summary, approve } → { report }                   staff text + frozen metrics
 *   POST { action: "send", ...period, to, subject, message, attachPdf } → { ok, channel } approved report only
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createActivity, markReportSent, upsertReport } from "@/lib/ir/db";
import { REPORT_SENT_PREFIX } from "@/lib/ir/metrics";
import { draftExecSummary, freeze, isExecSummary, reportData, type FrozenReport, type ReportKind } from "@/lib/ir/report";
import { renderReportPdf } from "@/lib/ir/report-pdf";
import { sendEmail } from "@/lib/email/send-email";

export const dynamic = "force-dynamic";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const periodSchema = z.object({
  kind: z.enum(["week", "month", "custom"]).default("week"),
  milestone: z.string().uuid().nullish(),
  start: z.string().regex(DAY).nullish(),
  end: z.string().regex(DAY).nullish(),
  compare: z.boolean().default(true),
});
type PeriodQ = z.infer<typeof periodSchema>;
const load = (id: string, q: PeriodQ) => reportData(id, { kind: q.kind as ReportKind, milestoneId: q.milestone ?? null, start: q.start ?? null, end: q.end ?? null, compare: q.compare });

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const parsed = periodSchema.safeParse({ kind: sp.get("kind") ?? "week", milestone: sp.get("milestone") || null, start: sp.get("start") || null, end: sp.get("end") || null, compare: sp.get("compare") !== "0" });
  if (!parsed.success) return NextResponse.json({ error: "Invalid period." }, { status: 400 });
  try {
    const { data, error } = await load(id, parsed.data);
    if (!data) return NextResponse.json({ error: error ?? "Couldn't build the report." }, { status: error === "Project not found." ? 404 : 400 });
    return NextResponse.json(data);
  } catch (e) { return failed(e, "Couldn't build the report."); }
}

const summarySchema = z.object({ bottom: z.string().max(600), lead: z.string().max(2000), highlights: z.array(z.string().max(400)).max(8), themes: z.array(z.string().max(400)).max(8), watch: z.array(z.string().max(400)).max(8), asks: z.array(z.string().max(400)).max(8) });
const postSchema = z.discriminatedUnion("action", [
  periodSchema.extend({ action: z.literal("draft") }),
  periodSchema.extend({ action: z.literal("save"), summary: summarySchema, approve: z.boolean().default(false) }),
  periodSchema.extend({ action: z.literal("send"), to: z.string().email(), subject: z.string().min(1).max(200), message: z.string().max(4000), attachPdf: z.boolean().default(true) }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const { id } = await ctx.params;
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const body = parsed.data;
  try {
    const { data, error } = await load(id, body);
    if (!data) return NextResponse.json({ error: error ?? "Couldn't build the report." }, { status: 400 });

    if (body.action === "draft") {
      const { summary, source } = await draftExecSummary(data);
      return NextResponse.json({ summary, source });
    }
    if (body.action === "save") {
      const report = await upsertReport({ projectId: id, period: data.period, execSummary: body.summary, metrics: freeze(data), approve: body.approve, by: me.id });
      return NextResponse.json({ report });
    }
    // send — only an approved snapshot goes out, and only to a real address
    const saved = data.saved;
    if (!saved || !saved.approved_at || !isExecSummary(saved.exec_summary)) return NextResponse.json({ error: "Approve the executive summary before sending." }, { status: 400 });
    const frozen = saved.metrics as unknown as FrozenReport;
    const attachments = body.attachPdf ? [{ filename: `Investor-Outreach-Report-${data.project.title.replace(/[^\w]+/g, "-")}-${data.period.start}.pdf`, content: (await renderReportPdf(frozen, saved.exec_summary)).toString("base64") }] : [];
    const html = `<p>${escapeHtml(body.message).replace(/\n/g, "<br>")}</p><p style="color:#5B6B86;font-size:12px">Confidential. Investor names and contact details are held by iCFO Capital Global, Inc. Firms are named once a meeting is booked. This report is not an offer to sell securities.</p>`;
    const delivered = await sendEmail({ to: body.to, subject: body.subject, html, text: body.message, fromName: me.full_name ?? undefined, attachments });
    if (!delivered) return NextResponse.json({ error: "Email isn't configured on this environment (RESEND_API_KEY), so the report was not sent." }, { status: 503 });
    await markReportSent(saved.id, body.to);
    await createActivity({ projectId: id, matchId: null, taskId: null, type: "email", subject: `${REPORT_SENT_PREFIX} · ${data.period.label}`, description: `Report ${saved.id} sent to ${body.to}`, doneAt: new Date().toISOString(), founderVisible: false, assigneeId: me.id, createdBy: me.id });
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't complete that."); }
}

function escapeHtml(s: string): string { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)); }
