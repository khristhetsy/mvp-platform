import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { archiveOutreachTarget, updateOutreachTarget } from "@/lib/founder-crm/outreach";
import { founderOutreachTargetUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = founderOutreachTargetUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid target update." }, { status: 400 });
  }

  if (parsed.data.action === "archive") {
    const result = await archiveOutreachTarget(auth.supabase, auth.profile.id, id);
    if (result.error) {
      return NextResponse.json({ error: "Unable to archive target." }, { status: 400 });
    }
    return NextResponse.json({ target: result.data });
  }

  const result = await updateOutreachTarget(auth.supabase, {
    targetId: id,
    founderId: auth.profile.id,
    patch: {
      status: parsed.data.status,
      notes: parsed.data.notes,
    },
  });

  if (result.error) {
    return NextResponse.json({ error: "Unable to update target." }, { status: 400 });
  }

  return NextResponse.json({ target: result.data });
}
