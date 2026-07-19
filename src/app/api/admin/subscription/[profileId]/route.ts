import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  loadAdminSubscription,
  extendTrial,
  compPlan,
  type CompDuration,
} from "@/lib/subscriptions/admin-actions";

export const dynamic = "force-dynamic";

const TRIAL_EXTEND_DAYS = 15;
const VALID_DURATIONS: CompDuration[] = ["30d", "6m", "1y", "indefinite"];

async function requireStaff(): Promise<{ userId: string; isSuperAdmin: boolean } | { error: Response }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_super_admin")
    .eq("id", user.id)
    .single();
  const row = profile as { role?: string | null; is_super_admin?: boolean | null } | null;
  if (row?.role !== "admin" && row?.role !== "analyst") {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }
  return { userId: user.id, isSuperAdmin: Boolean(row?.is_super_admin) };
}

export async function GET(_req: Request, ctx: { params: Promise<{ profileId: string }> }): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;
  const { profileId } = await ctx.params;
  const view = await loadAdminSubscription(profileId);
  return NextResponse.json({ ...view, canComp: gate.isSuperAdmin, extendDays: TRIAL_EXTEND_DAYS });
}

export async function POST(req: Request, ctx: { params: Promise<{ profileId: string }> }): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;
  const { profileId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { action?: string; duration?: string } | null;

  if (body?.action === "extend") {
    // Admin/analyst — fixed 15-day trial extension.
    const view = await extendTrial(profileId, TRIAL_EXTEND_DAYS, gate.userId);
    return NextResponse.json(view);
  }

  if (body?.action === "comp") {
    if (!gate.isSuperAdmin) {
      return NextResponse.json({ error: "Comping a plan requires super admin." }, { status: 403 });
    }
    const duration = body.duration as CompDuration;
    if (!VALID_DURATIONS.includes(duration)) {
      return NextResponse.json({ error: "Invalid duration." }, { status: 400 });
    }
    const view = await compPlan(profileId, duration, gate.userId);
    return NextResponse.json(view);
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
