import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/data/audit";
import { isConfirmPhrase, scheduledPurgeDate } from "@/lib/account/deletion";
import { cancelSubscription, resumeSubscription } from "@/lib/lemonsqueezy";
import { isCardSubscription } from "@/lib/billing/plan-change";

export const dynamic = "force-dynamic";

/** A founder asks to delete their own account. Starts the 30 day grace period. */
export async function POST(req: Request) {
  const userSupabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (!isConfirmPhrase(body.confirm)) {
    return NextResponse.json({ error: "Type the confirmation phrase exactly." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role?.toLowerCase() !== "founder" || profile.is_super_admin) {
    return NextResponse.json({ error: "Only founder accounts can be deleted here." }, { status: 403 });
  }

  // A card subscription keeps charging after the account is gone, so cancel it
  // first (paid access runs to the end of the period). If Lemon Squeezy refuses,
  // stop here rather than schedule a deletion that leaves a live subscription.
  const { data: subRaw } = await admin
    .from("subscriptions")
    .select("id, plan_type, ls_subscription_id, current_period_end, cancel_at_period_end")
    .eq("profile_id", user.id)
    .maybeSingle();
  const sub = subRaw as {
    id: string;
    plan_type: string;
    ls_subscription_id: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
  } | null;
  let cancelledByDeletion = false;
  if (sub?.ls_subscription_id && isCardSubscription(sub) && !sub.cancel_at_period_end) {
    try {
      await cancelSubscription(sub.ls_subscription_id);
      await admin
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          cancel_reason: "deletion",
          grace_period_ends_at: sub.current_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      cancelledByDeletion = true;
    } catch (err) {
      console.error("[account/delete] subscription cancel failed", err);
      return NextResponse.json(
        { error: "Couldn't cancel your subscription, so your account was not deleted. Try again." },
        { status: 502 },
      );
    }
  }

  const now = new Date();
  const scheduledFor = scheduledPurgeDate(now);
  const { error } = await admin
    .from("profiles")
    .update({
      deletion_requested_at: now.toISOString(),
      deletion_scheduled_for: scheduledFor.toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    // Put billing back the way it was so the founder is not left cancelled by accident.
    if (cancelledByDeletion && sub?.ls_subscription_id) {
      try {
        await resumeSubscription(sub.ls_subscription_id);
        await admin
          .from("subscriptions")
          .update({ cancel_at_period_end: false, cancel_reason: null, grace_period_ends_at: null })
          .eq("id", sub.id);
      } catch (err) {
        console.error("[account/delete] could not undo cancellation", err);
      }
    }
    return NextResponse.json({ error: "Couldn't schedule deletion. Try again." }, { status: 500 });
  }

  await writeAuditLog(admin, {
    userId: user.id,
    action: "account.deletion_requested",
    entityType: "profile",
    entityId: user.id,
    metadata: { scheduledFor: scheduledFor.toISOString() },
  });

  return NextResponse.json({ success: true, scheduledFor: scheduledFor.toISOString() });
}
