import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createSupportRequest, listFounderRequests, autoAssignSupportRequest, SUPPORT_SOURCES } from "@/lib/support/support";
import { createNotification, listStaffProfileIds, hasRecentNotification } from "@/lib/notifications/notifications";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  subject: z.string().min(1).max(160),
  body: z.string().max(4000).optional().default(""),
  source: z.enum(SUPPORT_SOURCES).optional(),
  contextStage: z.string().max(40).nullish(),
  contextItem: z.string().max(120).nullish(),
});

export async function GET(): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  return NextResponse.json({ requests: await listFounderRequests(supabase, profile.id) });
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });

  const { company } = await getActiveCompanyForUser(profile);
  if (!company) return NextResponse.json({ error: "No active company." }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A subject is required." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const result = await createSupportRequest(supabase, {
    companyId: company.id,
    founderId: profile.id,
    subject: parsed.data.subject,
    body: parsed.data.body ?? "",
    source: parsed.data.source,
    contextStage: parsed.data.contextStage ?? null,
    contextItem: parsed.data.contextItem ?? null,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  // Auto-assign (round-robin by load) via service role, then notify: the assignee
  // if one was picked, otherwise the staff pool as a fallback.
  try {
    const admin = createServiceRoleClient() as unknown as SupabaseClient<Database>;
    const assignee = await autoAssignSupportRequest(admin, result.id);
    if (assignee) {
      await createNotification({
        recipientUserId: assignee,
        type: "support_request_new",
        title: "New support request assigned to you",
        message: `${company.company_name ?? "A founder"}: ${parsed.data.subject}`,
        entityType: "company",
        entityId: company.id,
      });
    } else {
      const staff = await listStaffProfileIds();
      for (const staffId of staff.slice(0, 5)) {
        const dupe = await hasRecentNotification({ recipientUserId: staffId, type: "support_request_new", withinHours: 1 });
        if (dupe) continue;
        await createNotification({
          recipientUserId: staffId,
          type: "support_request_new",
          title: "New founder support request",
          message: `${company.company_name ?? "A founder"}: ${parsed.data.subject}`,
          entityType: "company",
          entityId: company.id,
        });
      }
    }
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: true, id: result.id });
}
