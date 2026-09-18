/**
 * Scheduled founder summaries (spec 5.9) — server only. Weekly goes out on Mondays for
 * the most recently completed project week; monthly goes out the day a month milestone
 * ends. The email is the founder-safe interactive digest — figures with change, pipeline
 * at period end, communications log (firms only once booked), IR notes — with no AI
 * text, so nothing needs approval. One send per project + period (ir_summary_sends).
 */
import { db, createActivity, listMilestones, listProjects } from "@/lib/ir/db";
import { REPORT_SENT_PREFIX } from "@/lib/ir/metrics";
import { reportData, type ReportData } from "@/lib/ir/report";
import { sendEmail } from "@/lib/email/send-email";
import type { IrMilestone, IrProject } from "@/lib/ir/types";

export type DueSummary = { project: IrProject; kind: "week" | "month"; milestone: IrMilestone };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/** Which project periods are due today (UTC date), before checking the send log. */
export function dueFor(project: IrProject, milestones: IrMilestone[], today: string): DueSummary[] {
  const out: DueSummary[] = [];
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();   // 1 = Monday
  if (project.weekly_summary && dow === 1) {
    const done = milestones.filter((m) => m.kind === "week" && m.ends_on <= today).sort((a, b) => b.sort_order - a.sort_order)[0];
    if (done) out.push({ project, kind: "week", milestone: done });
  }
  if (project.monthly_summary) {
    const ended = milestones.find((m) => m.kind === "month" && m.ends_on === today);
    if (ended) out.push({ project, kind: "month", milestone: ended });
  }
  return out;
}

export function summaryHtml(d: ReportData): { subject: string; html: string; text: string } {
  const first = d.founder.name.split(/\s+/)[0] || "there";
  const rows: Array<[string, keyof ReportData["metrics"]]> = [["Introductions sent", "intros"], ["Investors contacted", "contacted"], ["Meetings booked", "booked"], ["Meetings held", "held"], ["Commitments", "committed"]];
  const delta = (k: keyof ReportData["metrics"]) => { if (!d.prevMetrics) return ""; const v = d.metrics[k] - d.prevMetrics[k]; return v > 0 ? `+${v}` : v < 0 ? String(v) : "—"; };
  const total = d.pipeline.reduce((s, p) => s + p.count, 0);
  const cell = "padding:6px 8px;border-bottom:1px solid #E2E7F0;font-size:13px;color:#0F1B33";
  const head = "padding:6px 8px;border-bottom:1px solid #E2E7F0;font-size:11px;color:#5B6B86;text-align:left";
  const html = `
<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0F1B33">
  <p style="font-size:16px;font-weight:700;color:#0A1A40;margin:0">iCFO Capital Global, Inc.</p>
  <p style="font-size:12px;color:#5B6B86;margin:2px 0 18px">Investor Relations · ${esc(d.project.title)}</p>
  <h1 style="font-size:20px;margin:0 0 4px">Your investor outreach summary</h1>
  <p style="font-size:13px;color:#5B6B86;margin:0 0 16px">${esc(d.period.label)} · ${esc(d.project.monthLabel)} of the project</p>
  <p style="font-size:14px;line-height:1.6;margin:0 0 16px">Hi ${esc(first)}, ${esc(d.summary.replace(/^[^,]+, your/, "your"))}</p>
  <table style="border-collapse:collapse;width:100%;margin-bottom:18px"><thead><tr><th style="${head}">Measure</th><th style="${head};text-align:right">This period</th><th style="${head};text-align:right">${d.prevMetrics ? "Previous" : ""}</th><th style="${head};text-align:right">${d.prevMetrics ? "Change" : ""}</th></tr></thead>
  <tbody>${rows.map(([l, k]) => `<tr><td style="${cell}">${l}</td><td style="${cell};text-align:right">${d.metrics[k]}</td><td style="${cell};text-align:right">${d.prevMetrics ? d.prevMetrics[k] : ""}</td><td style="${cell};text-align:right">${delta(k)}</td></tr>`).join("")}</tbody></table>
  <h2 style="font-size:15px;margin:0 0 6px">Pipeline at period end <span style="font-weight:400;font-size:12px;color:#5B6B86">${esc(d.asOf)}</span></h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:18px"><tbody>${d.pipeline.map((p) => `<tr><td style="${cell}">${esc(p.label)}</td><td style="${cell};text-align:right">${p.count}</td></tr>`).join("")}<tr><td style="${cell};font-weight:600">Total matched</td><td style="${cell};text-align:right;font-weight:600">${total}</td></tr></tbody></table>
  <h2 style="font-size:15px;margin:0 0 6px">Communications log</h2>
  <p style="font-size:12px;color:#5B6B86;margin:0 0 6px">Every investor contact made on your behalf this period. Firms are named once a meeting is booked.</p>
  ${d.comms.length ? `<table style="border-collapse:collapse;width:100%;margin-bottom:18px"><thead><tr><th style="${head}">Date</th><th style="${head}">Channel</th><th style="${head}">Firm</th><th style="${head}">What happened</th><th style="${head}">Next step</th></tr></thead><tbody>${d.comms.map((c) => `<tr><td style="${cell}">${esc(c.date)}</td><td style="${cell}">${esc(c.channel)}</td><td style="${cell}">${esc(c.firm)}</td><td style="${cell}">${esc(c.what)}</td><td style="${cell};color:#5B6B86">${esc(c.next)}</td></tr>`).join("")}</tbody></table>` : `<p style="font-size:13px;color:#5B6B86;margin:0 0 18px">No investor contact logged in this period.</p>`}
  <h2 style="font-size:15px;margin:0 0 6px">Notes from your IR team</h2>
  ${d.notes.length ? d.notes.map((n) => `<p style="font-size:13px;line-height:1.55;margin:0 0 8px"><strong>${esc(n.date)}.</strong> ${esc(n.body)}</p>`).join("") : `<p style="font-size:13px;color:#5B6B86;margin:0 0 18px">No notes this period.</p>`}
  ${d.upcoming.length ? `<h2 style="font-size:15px;margin:18px 0 6px">Upcoming meetings</h2><ul style="font-size:13px;margin:0 0 18px;padding-left:18px">${d.upcoming.map((u) => `<li>${esc(u.firm)} · ${esc(u.when)}</li>`).join("")}</ul>` : ""}
  <p style="font-size:13px;line-height:1.55;margin:18px 0">Ask your iCFO contact before approaching any investor directly, so outreach is not duplicated. Your full written report with the executive summary is prepared and sent by ${esc(d.project.owner_name ?? "your IR contact")}.</p>
  <p style="font-size:11px;color:#5B6B86;line-height:1.5;margin-top:24px">Confidential. Prepared for ${esc(d.founder.name)} and ${esc(d.project.title)} only. Investor names and contact details are held by iCFO Capital Global, Inc. and are not included. Figures cover the period stated above and are drawn from the iCapOS Investor Relations Hub. This summary is not an offer to sell securities.</p>
</div>`;
  const text = [`Your investor outreach summary · ${d.period.label}`, "", d.summary, "", ...rows.map(([l, k]) => `${l}: ${d.metrics[k]}${d.prevMetrics ? ` (prev ${d.prevMetrics[k]})` : ""}`), "", `Pipeline ${d.asOf}: ${d.pipeline.map((p) => `${p.label} ${p.count}`).join(", ")}`, "", ...d.comms.map((c) => `${c.date} · ${c.channel} · ${c.firm} · ${c.what}${c.next ? ` → ${c.next}` : ""}`), "", ...d.notes.map((n) => `${n.date}. ${n.body}`)].join("\n");
  return { subject: `${d.project.title} investor outreach summary · ${d.period.label.split(" · ")[0]}`, html, text };
}

export async function runIrSummaries(today = new Date().toISOString().slice(0, 10)): Promise<{ due: number; sent: number; skipped: Array<{ project: string; kind: string; reason: string }> }> {
  const projects = (await listProjects({ status: "active" })).filter((p) => p.weekly_summary || p.monthly_summary);
  const skipped: Array<{ project: string; kind: string; reason: string }> = [];
  let due = 0, sent = 0;
  for (const project of projects) {
    const milestones = await listMilestones(project.id);
    for (const d of dueFor(project, milestones, today)) {
      due++;
      const { data: already } = await db().from("ir_summary_sends").select("id").eq("project_id", project.id).eq("kind", d.kind).eq("period_start", d.milestone.starts_on).maybeSingle();
      if (already) continue;
      const { data, error } = await reportData(project.id, { kind: d.kind, milestoneId: d.milestone.id, compare: true }, today);
      if (!data) { skipped.push({ project: project.title, kind: d.kind, reason: error ?? "no data" }); continue; }
      if (!data.founder.email) { skipped.push({ project: project.title, kind: d.kind, reason: "no founder email on file" }); continue; }
      const mail = summaryHtml(data);
      const ok = await sendEmail({ to: data.founder.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: project.owner_name ?? undefined }).catch(() => false);
      if (!ok) { skipped.push({ project: project.title, kind: d.kind, reason: "email not delivered (RESEND_API_KEY?)" }); continue; }
      const { error: logErr } = await db().from("ir_summary_sends").insert({ project_id: project.id, kind: d.kind, period_start: d.milestone.starts_on, period_end: d.milestone.ends_on, sent_to: data.founder.email });
      if (logErr) skipped.push({ project: project.title, kind: d.kind, reason: `sent but not logged: ${logErr.message}` });
      await createActivity({ projectId: project.id, matchId: null, taskId: null, type: "email", subject: `${REPORT_SENT_PREFIX} · ${d.kind === "week" ? "weekly" : "monthly"} summary · ${d.milestone.label}`, description: `Scheduled summary sent to ${data.founder.email}`, doneAt: new Date().toISOString(), founderVisible: false, assigneeId: project.owner_id, createdBy: project.owner_id }).catch(() => {});
      sent++;
    }
  }
  return { due, sent, skipped };
}

export async function lastSummarySends(projectId: string): Promise<Array<{ kind: string; period_start: string; sent_to: string; sent_at: string }>> {
  const { data } = await db().from("ir_summary_sends").select("kind, period_start, sent_to, sent_at").eq("project_id", projectId).order("sent_at", { ascending: false }).limit(6);
  return (data ?? []) as Array<{ kind: string; period_start: string; sent_to: string; sent_at: string }>;
}
