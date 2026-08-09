import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { emailDispatchAllowedForUser, EMAIL_DISABLED_MESSAGE } from "@/lib/organizations/organizations";
import {
  getManualOutreach,
  getManualRecipients,
  saveManualOutreach,
  enrollManualRecipients,
  type ManualOutreach,
  type ManualSequenceStep,
} from "@/lib/outreach/manual-outreach";

export const dynamic = "force-dynamic";

/** Load the founder's saved manual outreach campaign. */
export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ campaign: null, recipients: [] });

  const [campaign, recipients] = await Promise.all([
    getManualOutreach(company.id),
    getManualRecipients(company.id),
  ]);
  return NextResponse.json({ campaign, recipients });
}

function parseSequence(value: unknown): ManualSequenceStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is { label?: unknown; dayOffset?: unknown } => typeof s === "object" && s !== null)
    .map((s) => ({
      label: typeof s.label === "string" ? s.label : "",
      dayOffset: typeof s.dayOffset === "number" ? s.dayOffset : 0,
    }));
}

/**
 * Save or start the founder's manual campaign. Body:
 *   { action: "save" | "start", subject, body, sequence, recipientIds, stopOnReply }
 * "start" marks the campaign queued; live dispatch is gated separately.
 */
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || (body.action !== "save" && body.action !== "start")) {
    return NextResponse.json({ error: "Expected action 'save' or 'start'." }, { status: 400 });
  }

  const recipientIds = Array.isArray(body.recipientIds)
    ? body.recipientIds.filter((id): id is string => typeof id === "string")
    : [];

  if (body.action === "start" && recipientIds.length === 0) {
    return NextResponse.json({ error: "Add at least one investor before starting." }, { status: 400 });
  }

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 404 });

  // API-layer guard (spec §3a): starting a sequence queues live email dispatch,
  // so a demo / email-disabled account is refused here — saving a draft is fine.
  if (body.action === "start" && !(await emailDispatchAllowedForUser(createServiceRoleClient(), auth.profile.id))) {
    return NextResponse.json({ error: EMAIL_DISABLED_MESSAGE, code: "email_disabled" }, { status: 403 });
  }

  const payload: ManualOutreach = {
    status: body.action === "start" ? "queued" : "draft",
    emailSubject: typeof body.subject === "string" ? body.subject : "",
    emailBody: typeof body.body === "string" ? body.body : "",
    sequence: parseSequence(body.sequence),
    recipientIds,
    stopOnReply: body.stopOnReply !== false,
  };

  const ok = await saveManualOutreach(company.id, auth.profile.id, payload);
  if (!ok) {
    return NextResponse.json(
      { error: "Couldn't save. If this persists, the outreach table may need its migration run." },
      { status: 500 },
    );
  }

  // Starting the sequence enrolls the selected contacts into the send queue;
  // the cron send pass then dispatches each due step. Never block the response.
  if (body.action === "start") {
    try {
      await enrollManualRecipients(company.id, recipientIds);
    } catch {
      // Non-fatal — the campaign is saved; enrollment retries on next start.
    }
  }

  return NextResponse.json({ status: payload.status });
}
