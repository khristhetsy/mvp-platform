/** Plan tiers. PATCH { key, hold_limit?, show_email?, can_export?, price_cents? } → { ok } */
import { NextResponse } from "next/server";
import { z } from "zod";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { saveTier } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  key: z.string().min(1).max(40),
  hold_limit: z.number().int().min(0).max(1_000_000).optional(),
  show_email: z.boolean().optional(),
  can_export: z.boolean().optional(),
  price_cents: z.number().int().min(0).max(10_000_000).nullable().optional(),
});

export async function PATCH(request: Request) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the values and try again." }, { status: 400 });
  const { key, ...patch } = parsed.data;
  try {
    await saveTier(key, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failed(err, "Couldn't save the plan.");
  }
}
