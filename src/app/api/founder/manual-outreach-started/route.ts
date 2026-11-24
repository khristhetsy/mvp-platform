import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Whether the founder's company has sent at least one manual outreach email. The sidebar shows
 *  a dot on Outreach: Manual until this is true. Anything unknown counts as started, so the
 *  dot never shows by mistake. */
export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ started: true });

  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { count, error } = await admin
    .from("founder_manual_outreach_recipients")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .not("last_sent_at", "is", null);
  if (error) return NextResponse.json({ started: true });
  return NextResponse.json({ started: (count ?? 0) > 0 });
}
