import crypto from "crypto";
import type { PlanType } from "@/lib/subscriptions/plans";

/**
 * Pay first, account after. Pure helpers (no database, no network) so they are
 * unit tested: which plans can be paid before a login exists, the signed token
 * that opens the "create your login" step, and where /start sends a founder.
 */

/** Plans a founder can pay for before they have an account. Premium is not here: its Services Agreement is recorded against an account before checkout. */
export const GUEST_CHECKOUT_PLANS: readonly PlanType[] = ["founder_basic", "founder_professional"] as const;

export function isGuestCheckoutPlan(plan: PlanType | string | null | undefined): plan is "founder_basic" | "founder_professional" {
  return GUEST_CHECKOUT_PLANS.includes(plan as PlanType);
}

export const PAID_SIGNUP_COOKIE = "icapos_paid_signup";
/** A paid signup can be turned into a login for this long after payment. */
export const PAID_SIGNUP_CLAIM_DAYS = 30;

const DOMAIN = "paidsignup:";

function secret(): string {
  return process.env.MARKETING_UNSUBSCRIBE_SECRET ?? "default-secret";
}

function sign(id: string): string {
  return crypto.createHmac("sha256", secret()).update(DOMAIN + id).digest("hex").slice(0, 32);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Signed token for one paid signup row. Own domain prefix, so it is never valid as any other kind of token. */
export function makePaidSignupToken(id: string): string {
  return `${id}.${sign(id)}`;
}

export function verifyPaidSignupToken(token: string | null | undefined): string | null {
  if (!token || token.length > 120 || !token.includes(".")) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig || !UUID.test(id)) return null;
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null;
}

export function paidSignupLoginPath(token: string): string {
  return `/start/paid?t=${encodeURIComponent(token)}`;
}

/** The paid plan's claim window has run out. */
export function claimWindowOpen(paidAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!paidAt) return false;
  const at = Date.parse(paidAt);
  return Number.isFinite(at) && now.getTime() - at <= PAID_SIGNUP_CLAIM_DAYS * 24 * 60 * 60 * 1000;
}

export type StartChoice = "founder_free" | "founder_basic" | "founder_professional" | "founder_premium" | "investor" | undefined;

/**
 * Where /api/lead sends someone after the Start form.
 * - Basic or Professional with online payment on: the payment step, before any login exists.
 * - Everything else keeps the sign up page (Free, Premium with its agreement, investors, or payment not set up).
 */
export function startDestination(input: {
  email: string;
  role?: "founder" | "investor";
  startChoice: StartChoice;
  name?: string | null;
  company?: string | null;
  paymentsEnabled: boolean;
}): string {
  const email = encodeURIComponent(input.email);
  const isInvestor = input.role === "investor" || input.startChoice === "investor";
  if (isInvestor) return `/auth/sign-up?email=${email}&role=investor`;
  if (isGuestCheckoutPlan(input.startChoice) && input.paymentsEnabled) {
    const params = new URLSearchParams({ email: input.email, plan: input.startChoice });
    if (input.name?.trim()) params.set("name", input.name.trim().slice(0, 200));
    if (input.company?.trim()) params.set("company", input.company.trim().slice(0, 200));
    return `/start/pay?${params.toString()}`;
  }
  const plan =
    input.startChoice === "founder_premium" ? "founder_premium"
    : input.startChoice === "founder_professional" ? "founder_professional"
    : input.startChoice === "founder_free" ? "founder_free"
    : "founder_basic";
  return `/auth/sign-up?email=${email}&role=founder&plan=${plan}`;
}

/** The login link can be sent again only after this many minutes, so the form cannot be used to flood an inbox. */
export const RESEND_COOLDOWN_MINUTES = 5;

export type ResendState = "ok" | "not_paid" | "claimed" | "expired" | "cooldown";

/** Whether a paid signup may be sent its login link again right now. Pure, so staff and the public form follow the same rule. */
export function resendState(
  row: { status: string; paid_at: string | null; login_email_sent_at: string | null },
  now: Date = new Date(),
): ResendState {
  if (row.status === "claimed") return "claimed";
  if (row.status !== "paid") return "not_paid";
  if (!claimWindowOpen(row.paid_at, now)) return "expired";
  if (row.login_email_sent_at) {
    const sent = Date.parse(row.login_email_sent_at);
    if (Number.isFinite(sent) && now.getTime() - sent < RESEND_COOLDOWN_MINUTES * 60 * 1000) return "cooldown";
  }
  return "ok";
}
