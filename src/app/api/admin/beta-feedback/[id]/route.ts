import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
  adminNotes: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("beta_feedback")
    .update({
      status: parsed.data.status,
      admin_notes: parsed.data.adminNotes ?? null,
      reviewed_by: auth.profile.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Feedback not found." }, { status: 404 });
  }

  emitOperationalEvent(admin, {
    eventType: "beta.feedback_reviewed",
    eventCategory: "reporting",
    entityType: "beta_feedback",
    entityId: data.id,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    title: "Beta feedback reviewed",
    description: `Status set to ${parsed.data.status}`,
    sourceModule: "beta_operations",
    severity: "info",
    metadata: { status: parsed.data.status },
  });

  return NextResponse.json({ feedback: data });
}
