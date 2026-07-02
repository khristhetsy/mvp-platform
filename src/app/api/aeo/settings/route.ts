import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getSettings, updateSettings } from "@/lib/aeo/store";
import { runExposureCheck } from "@/lib/aeo/exposure-check";

export const dynamic = "force-dynamic";

const schema = z.object({
  deal_names_masked: z.boolean().optional(),
  security_page_noindexed: z.boolean().optional(),
});

export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const [settings, exposure] = await Promise.all([getSettings(), runExposureCheck()]);
    return NextResponse.json({ settings, exposure });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await updateSettings(parsed.data, profile.id);
    const exposure = await runExposureCheck();
    return NextResponse.json({ ok: true, exposure });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
