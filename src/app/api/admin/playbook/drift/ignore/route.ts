import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getHubSettings, updateHubSettings } from "@/lib/playbook/hub-settings";

export const dynamic = "force-dynamic";

const schema = z.object({
  navIds: z.array(z.string().min(1).max(200)).min(1).max(100),
  ignored: z.boolean(),
});

// POST /api/admin/playbook/drift/ignore — add/remove nav ids from the drift ignore list.
export async function POST(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin", "analyst"]);
    if (profile.role !== "admin") return NextResponse.json({ error: "Editing requires an admin." }, { status: 403 });
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const settings = await getHubSettings();
    const set = new Set(settings.driftIgnored);
    for (const id of parsed.data.navIds) {
      if (parsed.data.ignored) set.add(id);
      else set.delete(id);
    }
    await updateHubSettings({ driftIgnored: [...set] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
