import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, notifyStaffIfNotRecent } from "@/lib/notifications/notifications";

export const dynamic = "force-dynamic";

const schema = z.object({ companyId: z.string().uuid().optional(), userId: z.string().uuid().optional() }).refine((v) => v.companyId || v.userId, { message: "companyId or userId required" });

// POST /api/admin/onboarding/nudge — pre-escalation manual reminder (§5.3).
// Sends a manual-tier reminder to a not-yet-escalated user; logged via the
// notification store. Never fires automatically — only from an explicit admin click.
export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "companyId or userId is required." }, { status: 400 });

    const admin = createServiceRoleClient();
    let recipientUserId: string | null = parsed.data.userId ?? null;
    let companyName = "your onboarding";
    let companyId = parsed.data.companyId ?? "";

    if (parsed.data.companyId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (admin as any).from("companies").select("id, company_name, owner_id").eq("id", parsed.data.companyId).maybeSingle();
        if (data) {
          companyName = data.company_name ?? companyName;
          companyId = data.id;
          recipientUserId = recipientUserId ?? (data.owner_id ?? null);
        }
      } catch { /* owner column may differ → fall back to staff */ }
    }

    const payload = {
      type: "onboarding.nudge",
      severity: "normal" as const,
      title: `Reminder: finish onboarding — ${companyName}`,
      message: "A quick nudge to complete the remaining onboarding steps so your workspace stays on track.",
      entityType: "company",
      entityId: companyId,
      deepLink: companyId ? `/admin/companies/${companyId}` : "/admin/operations-hub",
    };

    if (recipientUserId) {
      await createNotification({ recipientUserId, ...payload });
    } else {
      // No founder user resolved — record the manual nudge against the staff pool so it's logged.
      await notifyStaffIfNotRecent({ ...payload, withinHours: 12 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Nudge failed." }, { status: 500 });
  }
}
