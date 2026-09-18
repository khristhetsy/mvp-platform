/**
 * Founder portal: the outreach report for one of the founder's own IR projects.
 *   GET ?project=<id>&kind=week|month|custom&milestone&start&end&compare=1 → FounderReportPayload
 *   GET (no project)                                                        → { projects }
 * Founder-safe only: no investor names, no staff notes, no schedule settings.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { founderProjects, founderReport } from "@/lib/ir/founder-report";
import type { ReportKind } from "@/lib/ir/report";

export const dynamic = "force-dynamic";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest): Promise<Response> {
  let profile;
  try { profile = await requireRole(["founder"]); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { company } = await getActiveCompanyForUser(profile);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("project");
  try {
    if (!projectId) return NextResponse.json({ projects: await founderProjects(company.id) });
    const kindRaw = sp.get("kind") ?? "week";
    const kind: ReportKind = kindRaw === "month" || kindRaw === "custom" ? kindRaw : "week";
    const start = sp.get("start"), end = sp.get("end");
    if (kind === "custom" && (!start || !end || !DAY.test(start) || !DAY.test(end))) return NextResponse.json({ error: "Pick both dates." }, { status: 400 });
    const { data, error, status } = await founderReport(company.id, projectId, { kind, milestoneId: sp.get("milestone") || null, start, end, compare: sp.get("compare") !== "0" });
    if (!data) return NextResponse.json({ error: error ?? "Couldn't load the report." }, { status });
    return NextResponse.json(data);
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load the report." }, { status: 500 }); }
}
