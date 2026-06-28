import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { getAppUrl } from "@/lib/env";
import { createNotification } from "@/lib/notifications/notifications";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";

const reminderSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(["founder", "investor"]),
});

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = reminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", parsed.data.profileId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const deepLink = parsed.data.role === "founder" ? "/founder/onboarding" : "/investor/onboarding";
  await createNotification({
    recipientUserId: profile.id,
    actorUserId: auth.profile.id,
    type: "beta.onboarding_reminder",
    title: "Complete your iCapOS onboarding",
    message:
      parsed.data.role === "founder"
        ? "Your founder workspace is waiting — finish onboarding and upload key documents."
        : "Complete your investor profile and submit for staff review to access opportunities.",
    deepLink,
    dedupeKey: `beta:reminder:${profile.id}:${new Date().toISOString().slice(0, 10)}`,
  });

  emitOperationalEvent(admin, {
    eventType: "beta.onboarding_reminder_sent",
    eventCategory: "onboarding",
    entityType: "profile",
    entityId: profile.id,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    title: "Onboarding reminder sent",
    description: `Staff sent onboarding reminder to ${profile.full_name ?? profile.email ?? profile.id}`,
    sourceModule: "beta_operations",
    severity: "info",
  });

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "beta.onboarding_reminder",
    entityType: "profile",
    entityId: profile.id,
    metadata: { targetRole: parsed.data.role },
  });

  const appUrl = getAppUrl() ?? "http://localhost:3000";

  return NextResponse.json({
    ok: true,
    loginLink: `${appUrl}/auth/sign-in`,
    deepLink: `${appUrl}${deepLink}`,
  });
}
