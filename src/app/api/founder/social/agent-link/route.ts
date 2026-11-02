import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { liveAgentForCompany } from "@/lib/ir-agent/links";
import { trackedUrl } from "@/lib/ir-agent/slug";

export const dynamic = "force-dynamic";

/**
 * The founder's own live IR agent, with its tracked link for each social network, for the
 * Agent link card in Compose post. Read only. { agent: null } when the founder has no live agent.
 */
export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ agent: null });
  const db = createServiceRoleClient() as unknown as SupabaseClient;
  const a = await liveAgentForCompany(db, company.id);
  if (!a) return NextResponse.json({ agent: null });
  return NextResponse.json({
    agent: {
      links: {
        linkedin: trackedUrl(a.company_slug, a.ending, "linkedin"),
        facebook: trackedUrl(a.company_slug, a.ending, "facebook"),
        instagram: trackedUrl(a.company_slug, a.ending, "instagram"),
      },
    },
  });
}
