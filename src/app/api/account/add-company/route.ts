import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { userCanAddCompanies } from "@/lib/organizations/organizations";

export const dynamic = "force-dynamic";

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

// POST — "Add a company" (Deal Company). Super-admin controlled: enforced HERE at
// the API layer, not just in the UI — a founder can only reach this if a super
// admin has granted `can_add_companies` on their org (Admin → Accounts). Self-
// serve checkout is deferred, so this provisions immediately.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const admin = createServiceRoleClient();

  if (!(await userCanAddCompanies(admin, auth.profile.id))) {
    return NextResponse.json(
      { error: "Adding a company isn't enabled for your account. Ask your iCapOS contact to enable it.", code: "not_entitled" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  const { data: org, error } = await loose(admin)
    .from("organizations")
    .insert({
      name,
      type: "spv",
      created_via: "signup",
      billing_status: "active",
      email_dispatch_enabled: true,
      created_by: auth.profile.id,
    })
    .select("*")
    .single();

  if (error || !org) {
    return NextResponse.json({ error: error?.message ?? "Could not add the company." }, { status: 500 });
  }

  const { error: memErr } = await loose(admin)
    .from("memberships")
    .insert({ user_id: auth.profile.id, org_id: (org as { id: string }).id, role: "owner" });
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  return NextResponse.json({ organization: org }, { status: 201 });
}
