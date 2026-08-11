import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

// PATCH — Entitlements: flip an org's billing between comped and active, and/or
// toggle the super-admin-controlled "can add companies" grant.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as
    | { billing_status?: string; can_add_companies?: boolean }
    | null;
  const patch: Record<string, unknown> = {};

  if (body?.billing_status !== undefined) {
    if (body.billing_status !== "comped" && body.billing_status !== "active") {
      return NextResponse.json({ error: "billing_status must be 'comped' or 'active'." }, { status: 400 });
    }
    patch.billing_status = body.billing_status;
    // Comping clears the Stripe association (spec §4, internal/comped path).
    if (body.billing_status === "comped") {
      patch.stripe_customer_id = null;
      patch.stripe_subscription_id = null;
    }
  }

  if (typeof body?.can_add_companies === "boolean") {
    patch.can_add_companies = body.can_add_companies;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const { data, error } = await loose(admin)
    .from("organizations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Update failed." }, { status: 500 });
  }
  return NextResponse.json({ organization: data });
}
