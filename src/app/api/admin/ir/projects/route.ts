/**
 * IR projects.
 *   GET  → { projects, counts, staff, sources, companies }
 *   POST { companyId?, founderContactId?, title, founderName?, ownerId, sourceOpportunityId?, startDate, termMonths, founderReportVisible, isSpv, force? } → { id }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createProject, listClosedWonSources, listFounderCompanies, listProjects, listStaff, projectCounts } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  try {
    const status = req.nextUrl.searchParams.get("status");
    const [projects, staff, sources, companies] = await Promise.all([listProjects({ status }), listStaff(), listClosedWonSources(), listFounderCompanies()]);
    const counts = Object.fromEntries(await projectCounts(projects.map((p) => p.id)));
    return NextResponse.json({ projects, counts, staff, sources, companies });
  } catch (e) { return failed(e, "Couldn't load projects."); }
}

const schema = z.object({
  companyId: z.string().uuid().nullish(),
  founderContactId: z.string().uuid().nullish(),
  title: z.string().min(1).max(160),
  founderName: z.string().max(160).nullish(),
  ownerId: z.string().uuid(),
  sourceOpportunityId: z.string().uuid().nullish(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  termMonths: z.number().int().min(4).max(6),
  founderReportVisible: z.boolean().default(true),
  isSpv: z.boolean().default(false),
  force: z.boolean().default(false),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await irStaff();
  if (!profile) return forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid project." }, { status: 400 });
  const d = parsed.data;
  if (!d.companyId && !d.founderContactId) return NextResponse.json({ error: "Pick a founder company or a founder contact." }, { status: 400 });
  try {
    // One active project per founder unless overridden (spec 5.2).
    if (!d.force) {
      const active = (await listProjects({ status: "active" })).filter((p) => (d.companyId && p.company_id === d.companyId) || (d.founderContactId && p.founder_contact_id === d.founderContactId));
      if (active.length) return NextResponse.json({ error: `${active[0].title} already has an active project.`, conflict: active[0].id }, { status: 409 });
    }
    const { id } = await createProject({
      companyId: d.companyId ?? null, founderContactId: d.founderContactId ?? null, title: d.title.trim(), founderName: d.founderName?.trim() || null,
      ownerId: d.ownerId, sourceOpportunityId: d.sourceOpportunityId ?? null, startDate: d.startDate, termMonths: d.termMonths,
      founderReportVisible: d.founderReportVisible, isSpv: d.isSpv, createdBy: profile.id,
    });
    return NextResponse.json({ id });
  } catch (e) { return failed(e, "Couldn't create the project."); }
}
