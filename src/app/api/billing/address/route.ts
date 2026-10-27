import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/data/audit";
import { billingOwnerOnlyResponse } from "@/lib/billing/billing-access";
import { parseBillingAddress } from "@/lib/billing/address";

export const dynamic = "force-dynamic";

/** Save the billing address printed on wire invoices and receipts. */
export async function PUT(req: Request) {
  const userSupabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = parseBillingAddress(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role?.toLowerCase() !== "founder") {
    return NextResponse.json({ error: "Only founder accounts have a billing address." }, { status: 403 });
  }
  const blocked = await billingOwnerOnlyResponse(user.id);
  if (blocked) return blocked;

  const { data, error } = await admin
    .from("subscriptions")
    .update({ billing_address: parsed.value, updated_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .select("id");
  if (error) return NextResponse.json({ error: "Couldn't save your address. Try again." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "No subscription found for this account." }, { status: 404 });

  await writeAuditLog(admin, { userId: user.id, action: "billing.address_updated", entityType: "subscription", entityId: data[0].id });
  return NextResponse.json({ success: true });
}
