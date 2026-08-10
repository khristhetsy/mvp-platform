import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

// PATCH — Entitlements: flip an org's billing between comped and active (spec §5).
// Comping waives the charge only; it never affects email dispatch or visibility.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermissionApi("manage_accounts");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { billing_status?: string } | null;
  const next = body?.billing_status;
  if (next !== "comped" && next !== "active") {
    return NextResponse.json({ error: "billing_status must be 'comped' or 'active'." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const patch: Record<string, unknown> = { billing_status: next };
  // Comping clears the Stripe association (spec §4, internal/comped path).
  if (next === "comped") {
    patch.stripe_customer_id = null;
    patch.stripe_subscription_id = null;
  }

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
