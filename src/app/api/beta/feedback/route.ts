import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createOperationalEvent } from "@/lib/operational-activity/create-event";
import { notifyStaff } from "@/lib/notifications/notifications";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const feedbackSchema = z.object({
  category: z.enum(["bug", "feature", "onboarding", "documents", "deal_room", "learning", "other"]),
  severity: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  message: z.string().min(3).max(4000),
  screenshotUrl: z.string().url().optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder", "investor"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const role = auth.profile.role === "investor" ? "investor" : "founder";

  const { data, error } = await admin
    .from("beta_feedback")
    .insert({
      profile_id: auth.profile.id,
      role,
      category: parsed.data.category,
      severity: parsed.data.severity,
      message: parsed.data.message.trim(),
      screenshot_url: parsed.data.screenshotUrl ?? null,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to submit feedback." }, { status: 400 });
  }

  await createOperationalEvent(admin, {
    eventType: "beta.feedback_submitted",
    eventCategory: "reporting",
    entityType: "beta_feedback",
    entityId: data.id,
    actorUserId: auth.profile.id,
    actorRole: role,
    title: "Beta feedback submitted",
    description: parsed.data.message.slice(0, 240),
    severity: parsed.data.severity === "critical" ? "critical" : parsed.data.severity === "high" ? "high" : "info",
    sourceModule: "beta_operations",
    metadata: { category: parsed.data.category, severity: parsed.data.severity },
  });

  void notifyStaff({
    actorUserId: auth.profile.id,
    type: "beta_feedback_submitted",
    title: "New beta feedback",
    message: `${role} feedback (${parsed.data.category}): ${parsed.data.message.slice(0, 120)}`,
    entityType: "beta_feedback",
    entityId: data.id,
    deepLink: "/admin/beta-operations",
  });

  return NextResponse.json({
    id: data.id,
    createdAt: data.created_at,
  });
}
