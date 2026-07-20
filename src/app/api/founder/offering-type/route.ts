import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Current founder's attested offering_type — used by the sidebar to gate the
 *  Reg-CF-only Marketplace nav item. */
export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ offeringType: null });

  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { data } = await admin.from("companies").select("offering_type").eq("id", company.id).maybeSingle();
  return NextResponse.json({ offeringType: (data as { offering_type?: string } | null)?.offering_type ?? null });
}
