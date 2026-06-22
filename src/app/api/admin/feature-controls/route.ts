import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import {
  loadFeatureFlags,
  isFeatureEnabled,
  featuresForAudience,
  FEATURE_AUDIENCES,
} from "@/lib/feature-controls";

export const dynamic = "force-dynamic";

/** GET — matrix of every valid audience×feature pair with defaults filled in. */
export async function GET() {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const flags = await loadFeatureFlags(auth.supabase);
  const matrix: Record<string, boolean> = {};
  for (const audience of FEATURE_AUDIENCES) {
    for (const feature of featuresForAudience(audience)) {
      matrix[`${audience}:${feature}`] = isFeatureEnabled(flags, audience, feature);
    }
  }
  return NextResponse.json({ matrix });
}

const putSchema = z.object({
  updates: z
    .array(
      z.object({
        audience: z.enum(["founder", "investor", "admin"]),
        feature: z.enum(["inbox", "calendar", "scheduling", "tasks", "signatures", "diligence"]),
        enabled: z.boolean(),
      }),
    )
    .max(40),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const rows = parsed.data.updates.map((u) => ({ ...u, updated_at: now }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (auth.supabase as any)
    .from("feature_flags")
    .upsert(rows, { onConflict: "audience,feature" });
  if (error) {
    return NextResponse.json({ error: error.message ?? "Save failed." }, { status: 500 });
  }

  await writeAuditLog(auth.userSupabase, {
    userId: auth.userId,
    action: "admin.feature_controls_updated",
    entityType: "feature_flags",
    entityId: auth.userId,
    metadata: { updates: parsed.data.updates },
  });

  return NextResponse.json({ success: true });
}
