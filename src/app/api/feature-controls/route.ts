import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadFeatureFlags, disabledHrefsFor } from "@/lib/feature-controls";

export const dynamic = "force-dynamic";

/** Nav hrefs the current user's role should not see (admin controls). */
export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = auth.profile.role;
  if (role !== "founder" && role !== "investor") {
    return NextResponse.json({ disabledHrefs: [] });
  }
  const flags = await loadFeatureFlags(createServiceRoleClient());
  return NextResponse.json({ disabledHrefs: disabledHrefsFor(flags, role) });
}
