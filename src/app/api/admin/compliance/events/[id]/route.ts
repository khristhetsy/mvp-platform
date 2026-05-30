import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { updateComplianceEvent } from "@/lib/compliance/events";
import { complianceEventUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = complianceEventUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compliance update." }, { status: 400 });
  }

  const result = await updateComplianceEvent(auth.supabase, {
    eventId: id,
    reviewerId: auth.profile.id,
    action: parsed.data.action,
    internalNotes: parsed.data.internalNotes,
    severity: parsed.data.severity,
  });

  if (result.error) {
    return NextResponse.json({ error: "Unable to update compliance event." }, { status: 400 });
  }

  return NextResponse.json({ event: result.data });
}
