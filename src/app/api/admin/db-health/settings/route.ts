import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEFAULT_HEALTH_SETTINGS, normalizeSettings } from "@/lib/db-health/evaluate";
import { DB_HEALTH_SETTINGS_KEY } from "@/lib/db-health/run";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    settings: z.object({
      warnMs: z.number(),
      overloadMs: z.number(),
      consecutive: z.number(),
      queryLimitS: z.number(),
      alertOnCronTimeouts: z.boolean(),
      notifyBell: z.boolean(),
      notifyEmail: z.boolean(),
    }),
  }),
  z.object({ action: z.literal("reset") }),
]);

/** POST /api/admin/db-health/settings: save or reset the alert limits. System access only. */
export async function POST(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Those settings aren't valid." }, { status: 400 });

  const next = parsed.data.action === "reset" ? DEFAULT_HEALTH_SETTINGS : normalizeSettings(parsed.data.settings);
  // A value outside its allowed range is replaced by the default, so tell the person.
  if (parsed.data.action === "save") {
    const sent = parsed.data.settings;
    const changed = (Object.keys(sent) as (keyof typeof sent)[]).filter((k) => sent[k] !== next[k]);
    if (changed.length) {
      return NextResponse.json(
        { error: "Some limits are out of range. The overload limit must stay under 8 s, the warning limit under the overload limit, and the query limit under 60 s.", fields: changed },
        { status: 400 },
      );
    }
  }

  // The health tables are not in the generated types, so use the untyped client as the other db-health code does.
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { error } = await admin
    .from("platform_settings")
    .upsert({ key: DB_HEALTH_SETTINGS_KEY, value: next, updated_by: auth.profile.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: parsed.data.action === "reset" ? "db_health.settings_reset" : "db_health.settings_saved",
    entityType: "db_health_settings",
    metadata: next as unknown as Record<string, unknown>,
  }).catch(() => {});

  return NextResponse.json({ ok: true, settings: next });
}
