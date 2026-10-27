import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/data/audit";
import { cancelSubscription, resumeSubscription } from "@/lib/lemonsqueezy";
import { canDowngrade, canSwitchFromPremium, cardPlanFor, isCardSubscription, isWirePremium, pendingPlanFor, type CardTarget, type DowngradeTarget } from "@/lib/billing/plan-change";
import { openWireInvoiceForProfile, voidWireInvoice } from "@/lib/billing/wire";

export const dynamic = "force-dynamic";

type Body = { action?: unknown; plan?: unknown };
type Sub = {
  id: string;
  plan_type: string;
  ls_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  cancel_reason: string | null;
  pending_plan_type: string | null;
};

/**
 * Founder self service for card plans (Basic, Professional) on Lemon Squeezy:
 * stop payment, resume, schedule a downgrade, undo a scheduled downgrade.
 * Access is kept until the paid period ends in every case.
 */
export async function POST(req: Request) {
  const userSupabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const action = typeof body.action === "string" ? body.action : "";

  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role?.toLowerCase() !== "founder") {
    return NextResponse.json({ error: "Only founder accounts can change a plan." }, { status: 403 });
  }

  const { data } = await admin
    .from("subscriptions")
    .select("id, plan_type, ls_subscription_id, current_period_end, cancel_at_period_end, cancel_reason, pending_plan_type")
    .eq("profile_id", user.id)
    .maybeSingle();
  const sub = data as Sub | null;
  // Premium paid by wire has no Lemon Squeezy subscription. Premium bought by card does,
  // and follows the card rules below so Stop payment really cancels it at Lemon Squeezy.
  const wire = isWirePremium(sub);
  if (!sub || (!wire && !isCardSubscription(sub))) {
    return NextResponse.json({ error: "No subscription found for this account." }, { status: 400 });
  }
  const lsId = sub.ls_subscription_id ?? "";
  const cancelling = Boolean(sub.cancel_at_period_end);

  const save = async (patch: Record<string, unknown>) => {
    const { error } = await admin
      .from("subscriptions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (error) throw new Error(error.message);
  };
  const audit = (name: string, metadata?: Record<string, unknown>) =>
    writeAuditLog(admin, { userId: user.id, action: `billing.${name}`, entityType: "subscription", entityId: sub.id, metadata });

  try {
    // Premium is paid by bank wire: stopping means no renewal invoice, and the
    // account moves to Free when the paid period ends (wire invoice cron).
    if (wire) {
      if (action === "stop") {
        if (cancelling) return NextResponse.json({ error: "Renewal is already stopped." }, { status: 400 });
        if (!sub.current_period_end) {
          return NextResponse.json({ error: "Your billing period isn't available yet. Try again later." }, { status: 409 });
        }
        await save({
          cancel_at_period_end: true,
          cancel_reason: "user",
          pending_plan_type: "founder_free",
          pending_plan_effective_at: sub.current_period_end,
        });
        // A renewal invoice that was already issued no longer applies.
        const open = await openWireInvoiceForProfile(user.id, admin);
        if (open?.is_renewal) await voidWireInvoice(open.id, null, admin);
        await audit("renewal_stopped");
        return NextResponse.json({ success: true, endsAt: sub.current_period_end });
      }
      if (action === "switch_to_card") {
        const target = body.plan === "professional" || body.plan === "basic" ? (body.plan as CardTarget) : null;
        if (!target || !canSwitchFromPremium(sub.plan_type, target)) {
          return NextResponse.json({ error: "That plan change isn't available." }, { status: 400 });
        }
        if (cancelling) return NextResponse.json({ error: "Undo the pending change first." }, { status: 409 });
        if (!sub.current_period_end) {
          return NextResponse.json({ error: "Your billing period isn't available yet. Try again later." }, { status: 409 });
        }
        // Same as Stop renewal, but remember the chosen card plan. The card plan
        // starts at checkout once Premium ends: Lemon Squeezy bills on checkout.
        await save({
          cancel_at_period_end: true,
          cancel_reason: "user",
          pending_plan_type: cardPlanFor(target),
          pending_plan_effective_at: sub.current_period_end,
        });
        const open = await openWireInvoiceForProfile(user.id, admin);
        if (open?.is_renewal) await voidWireInvoice(open.id, null, admin);
        await audit("premium_switch_scheduled", { to: target, effectiveAt: sub.current_period_end });
        return NextResponse.json({ success: true, effectiveAt: sub.current_period_end });
      }
      if (action === "resume" || action === "undo_downgrade") {
        if (!cancelling) return NextResponse.json({ error: "Renewal is not stopped." }, { status: 400 });
        await save({ cancel_at_period_end: false, cancel_reason: null, pending_plan_type: null, pending_plan_effective_at: null });
        await audit("renewal_resumed");
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: "That action isn't available for Premium." }, { status: 400 });
    }

    if (action === "stop") {
      if (cancelling) return NextResponse.json({ error: "Payment is already stopped." }, { status: 400 });
      if (!sub.current_period_end) {
        return NextResponse.json({ error: "Your billing period isn't available yet. Try again later." }, { status: 409 });
      }
      // Stop payment and downgrade to Free are the same: cancel now, keep access to
      // the end of the paid period, then land on the Free plan.
      await cancelSubscription(lsId);
      await save({
        cancel_at_period_end: true,
        cancel_reason: "user",
        grace_period_ends_at: sub.current_period_end,
        pending_plan_type: pendingPlanFor("free"),
        pending_plan_effective_at: sub.current_period_end,
      });
      await audit("stop_payment");
      return NextResponse.json({ success: true, endsAt: sub.current_period_end });
    }

    if (action === "resume") {
      if (!cancelling) return NextResponse.json({ error: "Payment is not stopped." }, { status: 400 });
      if (sub.cancel_reason === "deletion") {
        return NextResponse.json({ error: "Restore your account to resume this subscription." }, { status: 409 });
      }
      await resumeSubscription(lsId);
      await save({ cancel_at_period_end: false, cancel_reason: null, grace_period_ends_at: null, pending_plan_type: null, pending_plan_effective_at: null });
      await audit("resume_payment");
      return NextResponse.json({ success: true });
    }

    if (action === "downgrade") {
      const target = body.plan === "basic" || body.plan === "free" ? (body.plan as DowngradeTarget) : null;
      if (!target || !canDowngrade(sub.plan_type, target)) {
        return NextResponse.json({ error: "That plan change isn't available." }, { status: 400 });
      }
      if (cancelling) return NextResponse.json({ error: "Undo the pending change first." }, { status: 409 });
      if (!sub.current_period_end) {
        return NextResponse.json({ error: "Your billing period isn't available yet. Try again later." }, { status: 409 });
      }
      if (target === "free") {
        await cancelSubscription(lsId);
        await save({
          cancel_at_period_end: true,
          cancel_reason: "user",
          grace_period_ends_at: sub.current_period_end,
          pending_plan_type: pendingPlanFor(target),
          pending_plan_effective_at: sub.current_period_end,
        });
      } else {
        await save({ pending_plan_type: pendingPlanFor(target), pending_plan_effective_at: sub.current_period_end });
      }
      await audit("downgrade_scheduled", { to: target, effectiveAt: sub.current_period_end });
      return NextResponse.json({ success: true, effectiveAt: sub.current_period_end });
    }

    if (action === "undo_downgrade") {
      if (!sub.pending_plan_type) return NextResponse.json({ error: "No downgrade is scheduled." }, { status: 400 });
      if (cancelling && sub.cancel_reason !== "deletion") await resumeSubscription(lsId);
      await save({
        pending_plan_type: null,
        pending_plan_effective_at: null,
        ...(cancelling && sub.cancel_reason !== "deletion"
          ? { cancel_at_period_end: false, cancel_reason: null, grace_period_ends_at: null }
          : {}),
      });
      await audit("downgrade_cancelled");
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("[billing/subscription]", action, err);
    return NextResponse.json({ error: "Couldn't update your subscription. Try again." }, { status: 502 });
  }
}
