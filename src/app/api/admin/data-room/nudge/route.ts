import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { notifyCompanyFounder } from "@/lib/notifications/notifications";
import { computeDataRoomState } from "@/lib/data-room/completeness";
import { listCompanyDocuments } from "@/lib/data/documents";
import { sendDataRoomReminderEmail } from "@/lib/data-room/email";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ companyId: z.string().uuid() });

/** Staff one-click chase: notify (+ email) a founder about their incomplete data room. */
export async function POST(req: Request): Promise<Response> {
  const auth = await requirePermissionApi("manage_companies");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const admin = createServiceRoleClient();
    const { data: company } = await admin
      .from("companies")
      .select("id, company_name, founder_id")
      .eq("id", parsed.data.companyId)
      .maybeSingle();

    if (!company?.founder_id) return NextResponse.json({ error: "Company or founder not found." }, { status: 404 });

    const { data: docs } = await listCompanyDocuments(admin, company.id);
    const state = computeDataRoomState(docs ?? []);
    if (state.fullComplete) {
      return NextResponse.json({ error: "This data room is already complete." }, { status: 400 });
    }

    const missing = state.coreMissing.length > 0 ? state.coreMissing : state.items.filter((i) => i.status === "missing");
    const missingLabels = missing.map((i) => i.label).join(", ");
    const message = state.coreComplete
      ? `Your data room is ${state.percent}% complete. ${state.missingCount} document${state.missingCount === 1 ? "" : "s"} left for a full diligence package.`
      : `Your data room is ${state.percent}% complete. Please upload your investor-access essentials: ${missingLabels}.`;

    await notifyCompanyFounder(company.id, {
      type: "data_room_reminder",
      title: "Action needed: complete your data room",
      message,
      entityType: "company",
      entityId: company.id,
      actorUserId: auth.userId,
    });

    // Best-effort email (no-op unless RESEND_API_KEY is configured).
    let emailed = false;
    const { data: founder } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", company.founder_id)
      .maybeSingle();
    if (founder?.email) {
      emailed = await sendDataRoomReminderEmail({
        to: founder.email,
        founderName: founder.full_name ?? null,
        companyName: company.company_name ?? "your company",
        state,
      });
    }

    await writeAuditLog(auth.userSupabase, {
      userId: auth.userId,
      action: "data_room_nudge_sent",
      entityType: "company",
      entityId: company.id,
      metadata: { percent: state.percent, coreComplete: state.coreComplete, emailed },
    });

    return NextResponse.json({ ok: true, emailed });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to send the reminder." }, { status: 500 });
  }
}
