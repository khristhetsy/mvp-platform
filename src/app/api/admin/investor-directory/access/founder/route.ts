/**
 * One founder's directory access.
 *   PATCH { founderId, tier?, status?: "active"|"paused"|"suspended", reason?, requestId? } → { ok }
 * Passing requestId marks that upgrade request approved.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { setFounderAccess } from "@/lib/investor-directory/db";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  founderId: z.string().uuid(),
  tier: z.string().min(1).max(40).optional(),
  status: z.enum(["active", "paused", "suspended"]).optional(),
  reason: z.string().max(500).nullable().optional(),
  requestId: z.string().uuid().optional(),
});

export async function PATCH(request: Request) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the values and try again." }, { status: 400 });
  const { founderId, tier, status, reason, requestId } = parsed.data;
  try {
    await setFounderAccess(founderId, {
      ...(tier ? { tier } : {}),
      ...(status ? { status, status_reason: status === "active" ? null : (reason ?? null) } : {}),
    }, auth.adminId);
    if (requestId) {
      await serviceRoleClientUntyped().from("upgrade_requests").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", requestId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failed(err, "Couldn't update access.");
  }
}
