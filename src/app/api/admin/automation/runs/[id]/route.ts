import { NextResponse } from "next/server";
import { loadAutomationRunDetail } from "@/lib/automation/admin-console";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  if (auth.profile.role !== "admin" && auth.profile.role !== "analyst") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServiceRoleClient();
  const detail = await loadAutomationRunDetail(supabase, id);

  if (!detail) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
