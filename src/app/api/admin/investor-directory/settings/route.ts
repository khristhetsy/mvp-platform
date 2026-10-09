/** Gatekeeping rules. PATCH { …DirectorySettings fields } → { ok } */
import { NextResponse } from "next/server";
import { z } from "zod";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { saveSettings } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const int = (min: number, max: number) => z.number().int().min(min).max(max).optional();
const schema = z.object({
  block_over_limit: z.boolean().optional(),
  daily_cap: int(1, 100_000),
  spike_imports: int(1, 1_000_000),
  spike_hours: int(1, 720),
  auto_pause_on_bounce: z.boolean().optional(),
  bounce_pause_pct: int(1, 100),
  bounce_min_sends: int(1, 100_000),
  require_terms: z.boolean().optional(),
  honor_opt_outs: z.boolean().optional(),
  allow_export: z.boolean().optional(),
  stale_days: int(7, 3650),
});

export async function PATCH(request: Request) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the values and try again." }, { status: 400 });
  try {
    await saveSettings(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failed(err, "Couldn't save the rules.");
  }
}
