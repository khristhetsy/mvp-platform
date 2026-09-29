import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { db } from "@/lib/ir/db";
import { resyncProject } from "@/lib/ir/odoo-resync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Odoo activity history: hourly (see vercel.json), adds dated Agent Field entries
// (calls, emails, meetings, term sheets) to every project imported from Odoo. Idempotent,
// so each run only adds what is new in Odoo. Attributed to the project owner. CRON_SECRET protected.
async function historyGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  const { data } = await db().from("ir_projects").select("id, title, owner_id, odoo_project_ids").eq("status", "active").not("odoo_project_ids", "is", null);
  const projects = ((data ?? []) as Array<{ id: string; title: string; owner_id: string; odoo_project_ids: number[] | null }>).filter((p) => (p.odoo_project_ids ?? []).length > 0);
  const results = [];
  for (const p of projects) {
    try {
      const r = await resyncProject(p.id, p.owner_id, false);
      results.push({ project: p.title, odooTasks: r.odooTasks, tasksWithNotes: r.tasksWithNotes, entries: r.entries, chatter: r.chatterMessages, partnerMsgs: r.partnerMessages, openInOdoo: r.openOdooActivities, keywords: r.keywords, notImported: r.tasksNotImported, notes: r.skippedNotes, added: r.toAdd.total, calls: r.toAdd.call + r.toAdd.voicemail, emails: r.toAdd.email, meetings: r.toAdd.meeting, termSheets: r.toAdd.term_sheet, onTask: r.toAdd.onTask, alreadyPresent: r.alreadyPresent, undated: r.skippedUndated, stagesAdvanced: r.stagesAdvanced, movedToInvestor: r.movedToInvestor });
    } catch (e) {
      results.push({ project: p.title, error: e instanceof Error ? e.message : "failed" });
    }
  }
  // Short per-project line kept on the run (+added/entries, task chatter msgs, investor msgs naming the founder, open Odoo activities) (Admin, System, Scheduled jobs) and in the logs.
  const summary = results.map((r) => "error" in r ? `${r.project.slice(0, 18)}: ${(r.error ?? "failed").slice(0, 40)}` : `${r.project.slice(0, 12)}: +${r.added} moved ${r.movedToInvestor} stages ${r.stagesAdvanced} open ${r.openInOdoo}`).join(" | ");
  console.log("[ir-odoo-history]", JSON.stringify(results));
  return NextResponse.json({ projects: results.length, results }, { headers: { "x-cron-summary": (summary || "no imported projects").slice(0, 200) } });
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/ir-odoo-history", historyGET);
