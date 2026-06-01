import { NextResponse } from "next/server";
import { bulkUpdateActions } from "@/lib/actions/action-center";
import { requireApiProfile } from "@/lib/api/auth";
import { z } from "zod";

const bulkSchema = z.object({
  actionIds: z.array(z.string().uuid()).min(1).max(25),
  operation: z.enum(["complete", "dismiss", "snooze", "escalate"]),
  snoozedUntil: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bulk action request." }, { status: 400 });
  }

  if (parsed.data.operation === "escalate" && auth.profile.role !== "admin" && auth.profile.role !== "analyst") {
    return NextResponse.json({ error: "Only staff can bulk escalate." }, { status: 403 });
  }

  try {
    const results = await bulkUpdateActions(
      auth.supabase,
      auth.profile,
      parsed.data.actionIds,
      parsed.data.operation,
      { snoozedUntil: parsed.data.snoozedUntil },
    );
    return NextResponse.json({ updated: results.length, actions: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk update failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
