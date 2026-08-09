import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

// POST — admin-direct account creation (spec §3a, §4). Provisions a comped,
// email-dispatch-disabled org of either type directly, no Stripe/checkout.
// For demo + internal use only — real founders always go through signup.
export async function POST(request: Request) {
  const auth = await requirePermissionApi("manage_accounts");
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as
    | { type?: string; name?: string; purpose?: string; tier?: string }
    | null;

  const type = body?.type === "spv" || body?.type === "founder" ? body.type : null;
  const name = body?.name?.trim();
  const purpose = body?.purpose === "demo" || body?.purpose === "internal" ? body.purpose : null;
  // Deal Company has no tier; a Founder demo can carry a tier for CRR weighting.
  const tier = type === "founder" && (body?.tier === "basic" || body?.tier === "professional") ? body.tier : null;

  if (!type || !name) {
    return NextResponse.json({ error: "Type and name are required." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: org, error } = await loose(admin)
    .from("organizations")
    .insert({
      name,
      type,
      tier,
      created_via: "admin_direct",
      purpose,
      billing_status: "comped",
      email_dispatch_enabled: false,
      created_by: auth.profile.id,
    })
    .select("*")
    .single();

  if (error || !org) {
    return NextResponse.json({ error: error?.message ?? "Could not create account." }, { status: 500 });
  }

  const { error: memErr } = await loose(admin)
    .from("memberships")
    .insert({ user_id: auth.profile.id, org_id: (org as { id: string }).id, role: "owner" });
  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  return NextResponse.json({ organization: org }, { status: 201 });
}
