import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadFeatureFlags, disabledHrefsFor, type FeatureAudience } from "@/lib/feature-controls";

export const dynamic = "force-dynamic";

/** Nav hrefs the current user's role should not see (admin controls). */
export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = auth.profile.role;
  // Staff (admin/analyst) share the admin workspace audience.
  const audience: FeatureAudience | null =
    role === "founder" ? "founder" : role === "investor" ? "investor" : role === "admin" || role === "analyst" ? "admin" : null;
  if (!audience) return NextResponse.json({ disabledHrefs: [] });

  const flags = await loadFeatureFlags(createServiceRoleClient());
  return NextResponse.json({ disabledHrefs: disabledHrefsFor(flags, audience) });
}
