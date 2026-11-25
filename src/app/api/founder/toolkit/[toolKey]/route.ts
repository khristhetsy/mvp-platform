import { NextResponse } from "next/server";
import { founderPlanApiBlock } from "@/lib/subscriptions/founder-access";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";

/** Tool keys that belong to the paid toolset. due-diligence and kpi-glossary stay open on the Free plan. */
const PAID_TOOL_KEYS = new Set(["term-sheet", "pitch-practice", "email-sequence", "investor-update", "funding-timeline", "board-prep"]);

const VALID_TOOL_KEYS = new Set([
  "term-sheet",
  "pitch-practice",
  "email-sequence",
  "due-diligence",
  "investor-update",
  "funding-timeline",
  "board-prep",
  "kpi-glossary",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ toolKey: string }> },
) {
  let profile;
  try {
    profile = await requireRole(["founder"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { toolKey } = await params;
  if (!VALID_TOOL_KEYS.has(toolKey)) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
  }
  if (PAID_TOOL_KEYS.has(toolKey)) {
    const planBlock = await founderPlanApiBlock(profile.id);
    if (planBlock) return planBlock;
  }

  const admin = createServiceRoleClient();
  const { company } = await getActiveCompanyForUser(profile);
  if (!company) return NextResponse.json({ data: null });

  // Cast required: raise_toolkit_sessions was added in a migration whose types haven't been regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("raise_toolkit_sessions")
    .select("data")
    .eq("company_id", company.id)
    .eq("tool_key", toolKey)
    .maybeSingle() as { data: { data: unknown } | null };

  return NextResponse.json({ data: data?.data ?? null });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ toolKey: string }> },
) {
  let profile;
  try {
    profile = await requireRole(["founder"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { toolKey } = await params;
  if (!VALID_TOOL_KEYS.has(toolKey)) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
  }
  if (PAID_TOOL_KEYS.has(toolKey)) {
    const planBlock = await founderPlanApiBlock(profile.id);
    if (planBlock) return planBlock;
  }

  const body = await request.json().catch(() => null) as { data: unknown } | null;
  if (!body || body.data === undefined) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { company } = await getActiveCompanyForUser(profile);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // Cast required: raise_toolkit_sessions was added in a migration whose types haven't been regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("raise_toolkit_sessions")
    .upsert(
      {
        company_id: company.id,
        founder_id: profile.id,
        tool_key: toolKey,
        data: body.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,tool_key" },
    ) as { error: { message: string } | null };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
