/** Plan allowances. PATCH { plan_type, contacts?, emails_per_month? } → { ok } */
import { NextResponse } from "next/server";
import { z } from "zod";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { savePlanAllowance } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  plan_type: z.enum(["founder_free", "founder_basic", "founder_professional", "founder_premium"]),
  contacts: z.number().int().min(0).max(1_000_000).optional(),
  emails_per_month: z.number().int().min(0).max(10_000_000).optional(),
});

export async function PATCH(request: Request) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the values and try again." }, { status: 400 });
  const { plan_type, ...patch } = parsed.data;
  try {
    await savePlanAllowance(plan_type, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failed(err, "Couldn't save the plan allowance. Has the plan allowances migration been run?");
  }
}
