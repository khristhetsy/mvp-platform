import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { writeAuditLog } from "@/lib/data/audit";

type IntroStatus = "reviewing" | "facilitated" | "declined";

const VALID_STATUSES: IntroStatus[] = ["reviewing", "facilitated", "declined"];

/**
 * PATCH /api/admin/intro-requests/[id]
 *
 * Admin-only route to advance an intro request through its lifecycle.
 *
 * Body: { status: "reviewing" | "facilitated" | "declined", note?: string }
 *
 * On "facilitated":
 *   - notifies the investor that their intro has been facilitated
 *   - notifies the founder that the intro is live
 * On "declined":
 *   - notifies the investor that the intro request was not matched
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let profile;
  try {
    profile = await requireRole(["admin", "analyst"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null) as {
    status?: string;
    note?: string;
  } | null;

  if (!body?.status || !VALID_STATUSES.includes(body.status as IntroStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const newStatus = body.status as IntroStatus;
  const admin = createServiceRoleClient();

  // Load the intro request with related data
  const { data: intro, error: fetchErr } = await admin
    .from("intro_requests")
    .select(`
      id,
      status,
      investor_id,
      company_id,
      companies ( company_name, founder_id )
    `)
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !intro) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Update status + audit fields
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_by: profile.id,
    facilitator_note: body.note ?? null,
  };
  if (newStatus === "facilitated") {
    updatePayload.facilitated_at = new Date().toISOString();
  }

  // Cast required: facilitator_note, facilitated_at, updated_by are new columns from migration
  // whose types haven't been regenerated yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (admin as any)
    .from("intro_requests")
    .update(updatePayload)
    .eq("id", id) as { error: { message: string } | null };

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Derive related IDs
  const companyRow = Array.isArray(intro.companies)
    ? intro.companies[0]
    : intro.companies;
  const companyName: string = companyRow?.company_name ?? "a company";
  const founderId: string | null = companyRow?.founder_id ?? null;

  // ── Notifications ──────────────────────────────────────────────────────────

  if (newStatus === "facilitated") {
    // Notify investor
    await createNotification({
      recipientUserId: intro.investor_id,
      actorUserId: profile.id,
      type: "intro_facilitated",
      title: "Intro request facilitated",
      message: `Your intro request to ${companyName} has been facilitated. Check your inbox for next steps.`,
      entityType: "intro_request",
      entityId: id,
      deepLink: "/investor/dashboard",
      dedupeKey: `intro_facilitated:${id}`,
    });

    // Notify founder
    if (founderId) {
      await createNotification({
        recipientUserId: founderId,
        actorUserId: profile.id,
        type: "intro_facilitated_founder",
        title: "Investor intro is live",
        message: "An investor intro request for your company has been facilitated. Expect a message soon.",
        entityType: "intro_request",
        entityId: id,
        deepLink: "/founder/capital-raise",
        dedupeKey: `intro_facilitated_founder:${id}`,
      });
    }
  }

  if (newStatus === "declined") {
    await createNotification({
      recipientUserId: intro.investor_id,
      actorUserId: profile.id,
      type: "intro_declined",
      title: "Intro request not matched",
      message: `Your intro request to ${companyName} was reviewed but could not be facilitated at this time.`,
      entityType: "intro_request",
      entityId: id,
      deepLink: "/investor/dashboard",
      dedupeKey: `intro_declined:${id}`,
    });
  }

  return NextResponse.json({ updated: true, status: newStatus });
}

/**
 * DELETE /api/admin/intro-requests/[id]
 *
 * Admin-only hard delete of an intro request (removes it from the queue).
 * Analysts have review/decision access via PATCH but cannot delete records.
 * Audit-logged.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let profile;
  try {
    profile = await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createServiceRoleClient();
  const { error } = await admin.from("intro_requests").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await writeAuditLog(admin, {
    userId: profile.id,
    action: "intro_request_deleted",
    entityType: "intro_request",
    entityId: id,
  });
  return NextResponse.json({ deleted: true });
}
