import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { playbookNavIds } from "@/lib/playbook/nav";
import { upsertModule } from "@/lib/playbook/store";

export const dynamic = "force-dynamic";

// navId is a surface href (contains slashes), so it travels in the body rather
// than the path. Admin-only; analyst (read role) gets 403.
const schema = z.object({
  navId: z.string().min(1).max(200),
  block: z.enum(["open", "core", "close"]).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  role_note: z.string().max(280).nullable().optional(),
  cadence: z.enum(["daily", "2-3x_week", "weekly", "monthly"]).optional(),
  count_source: z.string().max(80).nullable().optional(),
  steps: z.array(z.object({ step_no: z.number().int(), body: z.string().max(1000) })).max(20).optional(),
  flags: z.array(z.object({ kind: z.enum(["hard_gate", "guardrail"]), label: z.string().max(160) })).max(8).optional(),
});

export async function PATCH(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin", "analyst"]);
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Read-only role — editing requires an admin." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    const { navId, ...rest } = parsed.data;
    if (!playbookNavIds().has(navId)) {
      return NextResponse.json({ error: "That surface is not in the current menu." }, { status: 404 });
    }

    await upsertModule(navId, rest, profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
