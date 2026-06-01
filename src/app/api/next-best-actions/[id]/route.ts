import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { updateActionStatus } from "@/lib/next-best-actions/lifecycle";
import { nextBestActionLifecycleSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = nextBestActionLifecycleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lifecycle update." }, { status: 400 });
  }

  try {
    const record = await updateActionStatus(auth.supabase, auth.profile, id, {
      action: parsed.data.action,
      snoozedUntil: parsed.data.snoozedUntil,
      note: parsed.data.note,
    });

    return NextResponse.json({ action: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update action.";
    const status = message.includes("not found")
      ? 404
      : message.includes("permissions") || message.includes("Only staff")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
