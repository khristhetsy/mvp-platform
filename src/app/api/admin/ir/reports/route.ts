/** Founder report landing: one row per active project with the latest report's status. GET → { rows } */
import { NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db, founderEmail, listMilestones, listProjects } from "@/lib/ir/db";
import { milestoneOn } from "@/lib/ir/milestones";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  try {
    const projects = await listProjects({ status: "active" });
    const today = new Date().toISOString().slice(0, 10);
    const rows = await Promise.all(projects.map(async (p) => {
      const [{ data: latest }, ms, email] = await Promise.all([
        db().from("ir_reports").select("id, period_kind, period_start, period_end, approved_at, sent_at, updated_at").eq("project_id", p.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        listMilestones(p.id), founderEmail(p),
      ]);
      const r = latest as { id: string; period_kind: string; period_start: string; period_end: string; approved_at: string | null; sent_at: string | null; updated_at: string } | null;
      const cur = milestoneOn(ms.filter((m) => m.kind === "month"), today);
      const status = !r ? "not_started" : r.sent_at ? "sent" : r.approved_at ? "approved" : "draft";
      return { id: p.id, title: p.title, founder_name: p.founder_name, owner_name: p.owner_name, milestone: cur ? `${cur.label} of ${p.term_months}` : "Term ended", status, period: r ? `${r.period_kind === "week" ? "Week" : r.period_kind === "month" ? "Month" : "Custom"} · ${r.period_start} to ${r.period_end}` : null, at: r ? (r.sent_at ?? r.approved_at ?? r.updated_at) : null, weekly: p.weekly_summary, monthly: p.monthly_summary, hasEmail: Boolean(email) };
    }));
    return NextResponse.json({ rows });
  } catch (e) { return failed(e, "Couldn't load reports."); }
}
