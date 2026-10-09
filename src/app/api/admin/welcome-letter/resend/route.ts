import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { latestWelcomeLetter, sendFounderWelcomeLetter } from "@/lib/notifications/founder-welcome-letter";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ founderId: z.string().uuid() });

/**
 * Staff: send the founder's welcome letter. First send (a client who paid
 * before the letter existed) goes out with the founder bell, like the
 * automatic one; when a letter was already sent this is a Resend.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error as NextResponse;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A founder id is required." }, { status: 400 });

  const prior = await latestWelcomeLetter(parsed.data.founderId);
  const resend = Boolean(prior && prior.status === "sent");
  const result = await sendFounderWelcomeLetter({ founderId: parsed.data.founderId, resend, triggeredBy: auth.profile.id });
  await writeAuditLog(auth.supabase as unknown as SupabaseClient, {
    userId: auth.profile.id,
    action: resend ? "welcome_letter_resent" : "welcome_letter_sent",
    entityType: "profile",
    entityId: parsed.data.founderId,
    metadata: { sent: result.sent, reason: result.reason },
  }).catch(() => undefined);

  if (!result.sent) return NextResponse.json({ ok: false, error: result.reason }, { status: 422 });
  return NextResponse.json({ ok: true });
}
