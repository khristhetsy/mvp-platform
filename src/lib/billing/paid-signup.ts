import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { BUY_LINKS } from "@/lib/billing/buy-links";
import {
  claimWindowOpen,
  isGuestCheckoutPlan,
  makePaidSignupToken,
  paidSignupLoginPath,
  resendState,
  type ResendState,
} from "@/lib/billing/paid-signup-core";
import { renderPaidSignupEmail } from "@/lib/billing/paid-signup-email";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { sendEmail } from "@/lib/email/send-email";
import { recordFunnelEvent } from "@/lib/analytics/funnel";
import { alertStaffNewCustomer } from "@/lib/notifications/new-customer-alerts";
import { alertStaffGuestPayment } from "@/lib/notifications/guest-payment-alert";
import { sendFounderWelcomeLetter } from "@/lib/notifications/founder-welcome-letter";
import { PLAN_LABELS, PLAN_PRICES, type PlanType } from "@/lib/subscriptions/plans";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;
function db(): Db {
  return createServiceRoleClient() as Db;
}

export type PaidSignupRow = {
  id: string;
  email: string;
  plan_type: PlanType;
  full_name: string | null;
  company: string | null;
  consent_accepted_at: string;
  consent_policy_version: string | null;
  consent_user_agent: string | null;
  status: "checkout_started" | "paid" | "claimed";
  paid_at: string | null;
  ls_subscription_id: string | null;
  ls_customer_id: string | null;
  ls_variant_id: string | null;
  ls_status: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
};

const COLUMNS =
  "id, email, plan_type, full_name, company, consent_accepted_at, consent_policy_version, consent_user_agent, status, paid_at, ls_subscription_id, ls_customer_id, ls_variant_id, ls_status, current_period_end, grace_period_ends_at, cancel_at_period_end";

export async function getPaidSignup(id: string): Promise<PaidSignupRow | null> {
  const { data } = await db().from("paid_signups").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as PaidSignupRow | null) ?? null;
}

/** True when an account already exists for this email (so it should sign in and upgrade, not pay as a new signup). */
export async function emailHasAccount(email: string): Promise<boolean> {
  const { data } = await db()
    .from("profiles")
    .select("id")
    .ilike("email", email.replace(/[\\%_]/g, (ch) => `\\${ch}`))
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

export async function createPaidSignup(input: {
  email: string;
  plan: PlanType;
  name?: string | null;
  company?: string | null;
  consentAcceptedAt: string;
  policyVersion?: string | null;
  userAgent?: string | null;
}): Promise<string> {
  const { data, error } = await db()
    .from("paid_signups")
    .insert({
      email: input.email.trim().toLowerCase(),
      plan_type: input.plan,
      full_name: input.name?.trim() || null,
      company: input.company?.trim() || null,
      consent_accepted_at: input.consentAcceptedAt,
      consent_policy_version: input.policyVersion ?? null,
      consent_user_agent: input.userAgent?.slice(0, 500) ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not start checkout: ${error?.message ?? "no row"}`);
  return (data as { id: string }).id;
}

/** The Lemon Squeezy checkout link for a guest. The signup id travels with the order so the webhook can find the row. Null when the plan has no buy link. */
export function guestCheckoutUrl(input: { plan: PlanType; email: string; name?: string | null; signupId: string }): string | null {
  if (!isGuestCheckoutPlan(input.plan)) return null;
  const buyUrl = BUY_LINKS[input.plan];
  if (!buyUrl) return null;
  const url = new URL(buyUrl);
  url.searchParams.set("checkout[email]", input.email);
  if (input.name?.trim()) url.searchParams.set("checkout[name]", input.name.trim());
  url.searchParams.set("checkout[custom][signup_id]", input.signupId);
  return url.toString();
}

/**
 * A subscription event for a payment made before any login existed. Saves what
 * the payment says on the paid signup row, and the first time it reads paid,
 * emails the private "create your login" link. Returns false when the row
 * cannot be found or written (the webhook then answers so it is retried or ignored).
 */
export async function recordGuestPayment(input: {
  signupId: string;
  lsSubscriptionId: string | null;
  lsCustomerId: string;
  lsVariantId: string;
  userEmail: string;
  plan: PlanType | null;
  status: string;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
}): Promise<{ found: boolean; error?: string }> {
  const row = await getPaidSignup(input.signupId);
  if (!row) return { found: false };
  if (row.status === "claimed") return { found: true };

  const becamePaid = row.status === "checkout_started" && input.status === "active";
  const patch: Record<string, unknown> = {
    ls_subscription_id: input.lsSubscriptionId,
    ls_customer_id: input.lsCustomerId,
    ls_variant_id: input.lsVariantId,
    ls_status: input.status,
    current_period_end: input.currentPeriodEnd,
    grace_period_ends_at: input.graceEndsAt,
    cancel_at_period_end: input.cancelAtPeriodEnd,
  };
  if (isGuestCheckoutPlan(input.plan)) patch.plan_type = input.plan;
  if (becamePaid) {
    patch.status = "paid";
    patch.paid_at = new Date().toISOString();
    patch.paid_email = input.userEmail;
  }
  const { error } = await db().from("paid_signups").update(patch).eq("id", row.id);
  if (error) return { found: true, error: error.message };

  if (becamePaid) {
    const plan = (patch.plan_type as PlanType | undefined) ?? row.plan_type;
    await sendLoginEmail({ ...row, plan_type: plan });
    // Staff hear about the payment now, not only after the founder creates a login.
    await alertStaffGuestPayment({
      signupId: row.id,
      email: input.userEmail || row.email,
      name: row.full_name,
      company: row.company,
      planLabel: PLAN_LABELS[plan] ?? "paid plan",
      currentPeriodEnd: input.currentPeriodEnd,
    });
  }
  return { found: true };
}

async function sendLoginEmail(row: Pick<PaidSignupRow, "id" | "email" | "plan_type" | "full_name">): Promise<boolean> {
  try {
    const mail = renderPaidSignupEmail({
      firstName: row.full_name?.split(/\s+/)[0] ?? null,
      planLabel: PLAN_LABELS[row.plan_type] ?? "paid",
      loginUrl: absoluteUrl(paidSignupLoginPath(makePaidSignupToken(row.id))),
    });
    const sent = await sendEmail({ to: row.email, subject: mail.subject, html: mail.html, text: mail.text, source: "billing/paid-signup", audience: "founder" });
    if (sent) await db().from("paid_signups").update({ login_email_sent_at: new Date().toISOString() }).eq("id", row.id);
    return Boolean(sent);
  } catch (err) {
    console.error("[paid-signup] login email failed (non-fatal)", err);
    return false;
  }
}

export type ResendResult = { ok: true } | { ok: false; reason: ResendState | "not_found" | "send_failed" };

/** Sends the private "create your login" link again. Same rule for staff and for the public form. */
export async function resendLoginLink(signupId: string): Promise<ResendResult> {
  const row = await db()
    .from("paid_signups")
    .select("id, email, plan_type, full_name, status, paid_at, login_email_sent_at")
    .eq("id", signupId)
    .maybeSingle()
    .then((r: { data: (Pick<PaidSignupRow, "id" | "email" | "plan_type" | "full_name" | "status" | "paid_at"> & { login_email_sent_at: string | null }) | null }) => r.data);
  if (!row) return { ok: false, reason: "not_found" };
  const state = resendState(row);
  if (state !== "ok") return { ok: false, reason: state };
  const sent = await sendLoginEmail(row);
  return sent ? { ok: true } : { ok: false, reason: "send_failed" };
}

/** The public "Paid but have no login yet?" form. Finds the paid, unclaimed signup for the email that paid. Null when there is none. */
export async function findResendableSignupId(email: string): Promise<string | null> {
  const clean = email.trim().toLowerCase();
  if (!clean) return null;
  const { data } = await db()
    .from("paid_signups")
    .select("id, email, paid_email, status")
    .eq("status", "paid")
    .or(`email.eq.${clean.replace(/[,()]/g, "")},paid_email.eq.${clean.replace(/[,()]/g, "")}`)
    .order("paid_at", { ascending: false })
    .limit(1);
  const row = Array.isArray(data) ? data[0] : null;
  return row ? String((row as { id: string }).id) : null;
}

export type AdminPaidSignupRow = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  plan_type: PlanType;
  status: "checkout_started" | "paid" | "claimed";
  paid_at: string | null;
  login_email_sent_at: string | null;
  claimed_at: string | null;
  ls_status: string | null;
};

/** Everyone who started or finished a pay first checkout, newest first. Staff list. */
export async function listPaidSignupsForAdmin(limit = 200): Promise<AdminPaidSignupRow[]> {
  const { data } = await db()
    .from("paid_signups")
    .select("id, email, full_name, company, plan_type, status, paid_at, login_email_sent_at, claimed_at, ls_status")
    .in("status", ["paid", "claimed"])
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as AdminPaidSignupRow[];
}

export type ClaimResult =
  | { ok: true; profileId: string; email: string }
  | { ok: false; status: number; code: "not_found" | "not_paid" | "claimed" | "expired" | "exists" | "failed"; error: string };

/**
 * Turns a paid signup into a login: creates the account with the email that
 * paid, applies the paid plan, records the billing terms they accepted, and
 * runs the same first payment steps the webhook runs for a normal checkout.
 */
export async function claimPaidSignup(input: { signupId: string; password: string; fullName?: string | null }): Promise<ClaimResult> {
  const row = await getPaidSignup(input.signupId);
  if (!row) return { ok: false, status: 404, code: "not_found", error: "We could not find this payment." };
  if (row.status === "claimed") return { ok: false, status: 409, code: "claimed", error: "Your login is already created. Please sign in." };
  if (row.status !== "paid") return { ok: false, status: 409, code: "not_paid", error: "We have not received your payment yet. Please wait a moment." };
  if (!claimWindowOpen(row.paid_at)) return { ok: false, status: 410, code: "expired", error: "This link has expired. Please contact us and we will finish your setup." };

  const admin = db();
  const fullName = input.fullName?.trim() || row.full_name || null;
  const created = await admin.auth.admin.createUser({
    email: row.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { ...(fullName ? { full_name: fullName } : {}), role: "founder", requested_plan: row.plan_type },
  });
  if (created.error || !created.data?.user) {
    const message = created.error?.message ?? "";
    if (/already|registered|exists/i.test(message)) {
      return { ok: false, status: 409, code: "exists", error: "An account with this email already exists. Please sign in, or contact us to apply your payment." };
    }
    console.error("[paid-signup] create user failed", message);
    return { ok: false, status: 500, code: "failed", error: "We could not create your login. Please try again, or contact us." };
  }
  const profileId = (created.data.user as { id: string }).id;

  // The profile row is created by a database trigger on the new auth user.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data } = await admin.from("profiles").select("id").eq("id", profileId).maybeSingle();
    if (data) break;
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }

  const now = new Date().toISOString();
  const { error: subError } = await admin.from("subscriptions").upsert(
    {
      profile_id: profileId,
      role: "founder",
      plan_type: row.plan_type,
      subscription_status: row.ls_status ?? "active",
      ls_subscription_id: row.ls_subscription_id,
      ls_customer_id: row.ls_customer_id,
      ls_variant_id: row.ls_variant_id,
      current_period_start: now,
      current_period_end: row.current_period_end,
      grace_period_ends_at: row.grace_period_ends_at,
      cancel_at_period_end: row.cancel_at_period_end,
      monthly_price_cents: PLAN_PRICES[row.plan_type],
      currency: "USD",
      updated_at: now,
    },
    { onConflict: "profile_id" },
  );
  if (subError) {
    console.error("[paid-signup] subscription write failed", subError.message);
    return { ok: false, status: 500, code: "failed", error: "Your payment is safe, but we could not finish setup. Please contact us." };
  }

  try {
    await admin.from("billing_consents").insert({
      profile_id: profileId,
      email: row.email,
      plan_type: row.plan_type,
      policy_version: row.consent_policy_version,
      accepted_at: row.consent_accepted_at,
      user_agent: row.consent_user_agent,
    });
  } catch (err) {
    console.error("[paid-signup] consent record failed (non-fatal)", err);
  }

  await admin
    .from("paid_signups")
    .update({ status: "claimed", claimed_at: now, claimed_profile_id: profileId })
    .eq("id", row.id)
    .eq("status", "paid");

  // The first payment steps the webhook runs for a normal checkout. None of them may fail the login.
  try {
    await recordFunnelEvent({ sessionId: `webhook_${profileId}`, eventName: "checkout_complete", properties: { plan: row.plan_type, event: "guest_claim" } });
    await sendFounderWelcomeLetter({ founderId: profileId, plan: row.plan_type });
    await alertStaffNewCustomer({ event: "payment", founderId: profileId, plan: row.plan_type });
  } catch (err) {
    console.error("[paid-signup] first payment steps failed (non-fatal)", err);
  }
  return { ok: true, profileId, email: row.email };
}
