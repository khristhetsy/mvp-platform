import { NextResponse } from "next/server";
import { loadActionCenterDetail } from "@/lib/actions/action-center";
import { requireApiProfile } from "@/lib/api/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;

  try {
    const detail = await loadActionCenterDetail(auth.supabase, auth.profile, id);
    if (!detail) {
      return NextResponse.json({ error: "Action not found." }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load action.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
