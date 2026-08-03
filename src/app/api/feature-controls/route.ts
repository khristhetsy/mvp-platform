import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadFeatureFlags, disabledHrefsFor, type FeatureAudience } from "@/lib/feature-controls";
import { getFounderNavV2RolloutPct } from "@/lib/settings/platform-settings";

export const dynamic = "force-dynamic";

/** Stable 0–99 bucket for a user id, so cohort membership never flips per load. */
function navBucket(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 100;
}

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

  // Runtime toggle for the consolidated 4-step founder nav. Precedence:
  //   1. feature_flags row `founder:nav_v2` (true/false) — master switch, all founders.
  //   2. otherwise a cohort rollout %: this founder is in if navBucket(id) < pct.
  //   3. otherwise the NEXT_PUBLIC_FOUNDER_NAV_V2 build flag.
  // Absent everywhere = off (current nav). All runtime — no redeploy needed.
  let founderNavV2 = false;
  if (audience === "founder") {
    const navV2Row = flags["founder:nav_v2"];
    if (navV2Row === true) {
      founderNavV2 = true;
    } else if (navV2Row === false) {
      founderNavV2 = false;
    } else {
      const pct = await getFounderNavV2RolloutPct();
      founderNavV2 = pct > 0
        ? navBucket(auth.profile.id) < pct
        : process.env.NEXT_PUBLIC_FOUNDER_NAV_V2 === "on";
    }
  }

  return NextResponse.json({ disabledHrefs: disabledHrefsFor(flags, audience), founderNavV2 });
}
