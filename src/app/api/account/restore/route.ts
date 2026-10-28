import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/data/audit";
import { isPurgeDue } from "@/lib/account/deletion";
import { resumeSubscription } from "@/lib/lemonsqueezy";
import { isActingAsFounder } from "@/lib/admin/acting-central";

export const dynamic = "force-dynamic";

/** Cancel a pending deletion while the 30 day window is still open. */
export async function POST() {
  const userSupabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (await isActingAsFounder()) {
    return NextResponse.json({ error: "An account can only be restored by its Owner." }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("deletion_scheduled_for")
    .eq("id", user.id)
    .single();

  if (!profile?.deletion_scheduled_for) {
    return NextResponse.json({ error: "This account isn't scheduled for deletion." }, { status: 400 });
  }
  if (isPurgeDue(profile.deletion_scheduled_for)) {
    return NextResponse.json({ error: "The restore window has closed." }, { status: 410 });
  }

  // Billing: resume only a subscription that account deletion cancelled, and only
  // while its paid period is still open. A lapsed one can't be resumed, so the
  // founder restores the account and picks a plan again.
  const { data: subRaw } = await admin
    .from("subscriptions")
    .select("id, ls_subscription_id, cancel_reason, cancel_at_period_end, current_period_end")
    .eq("profile_id", user.id)
    .maybeSingle();
  const sub = subRaw as {
    id: string;
    ls_subscription_id: string | null;
    cancel_reason: string | null;
    cancel_at_period_end: boolean | null;
    current_period_end: string | null;
  } | null;
  if (sub?.cancel_reason === "deletion" && sub.ls_subscription_id) {
    const open = sub.current_period_end ? Date.parse(sub.current_period_end) > Date.now() : false;
    if (open) {
      try {
        await resumeSubscription(sub.ls_subscription_id);
      } catch (err) {
        console.error("[account/restore] subscription resume failed", err);
        return NextResponse.json({ error: "Couldn't restore your billing. Try again." }, { status: 502 });
      }
    }
    await admin
      .from("subscriptions")
      .update({ cancel_at_period_end: false, cancel_reason: null, grace_period_ends_at: null, updated_at: new Date().toISOString() })
      .eq("id", sub.id);
  }

  const { error } = await admin
    .from("profiles")
    .update({ deletion_requested_at: null, deletion_scheduled_for: null })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't restore your account. Try again." }, { status: 500 });

  await writeAuditLog(admin, {
    userId: user.id,
    action: "account.deletion_cancelled",
    entityType: "profile",
    entityId: user.id,
  });

  return NextResponse.json({ success: true });
}
