import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { resolveSupportRequester } from "@/lib/support/requester";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { listFounderRequests, SUPPORT_SOURCES } from "@/lib/support/support";
import { submitSupportRequest } from "@/lib/support/submit";

export const dynamic = "force-dynamic";

const schema = z.object({
  subject: z.string().min(1).max(160),
  body: z.string().max(4000).optional().default(""),
  source: z.enum(SUPPORT_SOURCES).optional(),
  contextStage: z.string().max(40).nullish(),
  contextItem: z.string().max(120).nullish(),
});

export async function GET(): Promise<Response> {
  const profile = await requireRole(["founder", "investor"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders and investors only." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  return NextResponse.json({ requests: await listFounderRequests(supabase, profile.id) });
}

export async function POST(req: NextRequest): Promise<Response> {
  // A founder or investor sends their own; staff acting as a founder send it for them.
  const who = await resolveSupportRequester();
  if (!who) return NextResponse.json({ error: "Founders and investors only." }, { status: 403 });
  const profile = who.profile;

  // Investors have no company; their ticket carries only their own profile.
  const isInvestor = profile.role === "investor";
  const company = isInvestor ? null : (who.actingCompany ?? (await getActiveCompanyForUser(profile)).company);
  if (!isInvestor && !company) return NextResponse.json({ error: "No active company." }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "");
    const msg = field === "subject" ? "A subject is required (up to 160 characters)."
      : field === "body" ? "Your message is too long — keep it under 4,000 characters."
      : "Invalid request.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Create, auto-assign (round-robin by load) and set the promised reply time.
  // Staff alerts, the founder's confirmation email, AI triage and the log run
  // after the response (see lib/support/care.ts).
  const result = await submitSupportRequest(who.supabase, {
    companyId: company?.id ?? null,
    requesterRole: isInvestor ? "investor" : "founder",
    founderId: profile.id,
    subject: parsed.data.subject,
    body: parsed.data.body ?? "",
    source: parsed.data.source,
    contextStage: parsed.data.contextStage ?? null,
    contextItem: parsed.data.contextItem ?? null,
    via: parsed.data.contextItem === "Assistant" ? "assistant" : "form",
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  // Staff acting as the founder: record who really sent it.
  if (who.actingStaffId) {
    await writeAuditLog(createServiceRoleClient(), {
      userId: who.actingStaffId,
      action: "support.request_created_acting",
      entityType: "support_request",
      entityId: result.id,
      metadata: { actingForFounderId: profile.id },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: result.id, ownerName: result.ownerName, dueAt: result.dueAt });
}
