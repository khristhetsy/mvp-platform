import { createServiceRoleClient } from "@/lib/supabase/admin";
import { absoluteUrl, escapeHtml } from "@/lib/activity/email-templates";
import { sendEmail } from "@/lib/email/send-email";
import { EMAIL_BRAND } from "@/lib/email/brand";
import { createNotification } from "@/lib/notifications/notifications";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { getFounderConnectionConfig, type FounderConnectionConfig } from "@/lib/settings/platform-settings";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { PLAN_LABELS, PLAN_PRICES, type PlanType } from "@/lib/subscriptions/plans";
import { supportInboundEnabled, supportInboxAddress } from "@/lib/support/inbound";
import { formatPlatformDateTime } from "@/lib/time/platform-tz";

/**
 * The welcome letter a founder gets on their first payment: plan and price,
 * what the plan includes, their open onboarding steps, and one button.
 *
 * Sent once (the billing webhook calls it on checkout; renewals and retried
 * deliveries don't resend it). Every send is written to the email log with
 * source "welcome_letter", so delivery, opens, clicks and bounces are tracked
 * the same way as every other platform email. Staff can resend it from
 * Analytics & Tools, Emails sent.
 */
export const WELCOME_LETTER_SOURCE = "welcome_letter";
export const FOUNDER_WELCOME_TYPE = "founder_welcome";

const NAVY = "#0A1A40";
const BLUE = "#1A6CE4";
const GREEN = "#16A34A";
const MUTED = "#64748B";
const LINE = "#E2E8F0";
const FONT = "Helvetica, Arial, sans-serif";

const DISCLAIMER =
  "iCFO Capital Global, Inc. does not solicit securities and is not an investment adviser. Content is for educational purposes only.";

export type WelcomeStep = { key: string; done: boolean };

export type WelcomeLetterData = {
  founderId: string;
  email: string;
  firstName: string | null;
  companyName: string | null;
  plan: PlanType;
  priceCents: number;
  startedAt: string | null;
  renewsAt: string | null;
  onboardingPercent: number | null;
  steps: WelcomeStep[];
  crrScore: number | null;
};

const STEP_ORDER = ["company_profile", "investor_readiness_review", "documents_uploaded", "funding_information"] as const;

const STEP_COPY: Record<string, { html: string; text: string }> = {
  company_profile: { html: "<b>Complete your company profile.</b>", text: "Complete your company profile." },
  investor_readiness_review: { html: "<b>Finish your investor readiness review.</b>", text: "Finish your investor readiness review." },
  documents_uploaded: {
    html: "<b>Upload your documents</b> to the data room (pitch deck, financials, cap table).",
    text: "Upload your documents to the data room (pitch deck, financials, cap table).",
  },
  funding_information: { html: "<b>Complete your funding information.</b>", text: "Complete your funding information." },
};

const CRR_STEP = {
  html: "<b>Get your Capital Readiness Rating.</b> It shows investors where you stand and unlocks outreach.",
  text: "Get your Capital Readiness Rating. It shows investors where you stand and unlocks outreach.",
};

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const RECENT_START_MS = 2 * 86_400_000;

/** The period start when it is a recent payment, else null (row left out). */
export function startedIfRecent(periodStart: string | null, now: Date = new Date()): string | null {
  if (!periodStart) return null;
  const t = Date.parse(periodStart);
  return Number.isFinite(t) && now.getTime() - t <= RECENT_START_MS ? periodStart : null;
}

function firstNameOf(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/** What the plan includes, from the same entitlements and limits the platform enforces. */
export function planFeatures(plan: PlanType, conn: FounderConnectionConfig): string[] {
  const ent = founderEntitlements(plan);
  const out = ["All founder tools: Capital Readiness Rating, data room, valuation and e-learning"];
  if (ent.revealInvestorIdentities) out.push("Full profiles of your matched investors");
  if (ent.canDistribute) {
    out.push(
      ent.investorCap == null
        ? "Your own outreach and one pager to all your matched investors"
        : `Your own outreach and one pager to up to ${ent.investorCap} matched investors`,
    );
  }
  if (ent.canBrokerIntros) {
    const tier = plan === "founder_basic" ? "basic" : plan === "founder_professional" ? "professional" : null;
    if (tier) {
      const monthly = conn.monthlyByPlan[tier];
      const weekly = conn.weeklyByPlan?.[tier] ?? null;
      out.push(`Introductions through iCFO: up to ${monthly} requests a month${weekly != null ? `, ${weekly} a week` : ""}`);
    } else {
      out.push("Introductions through iCFO, handled by our team");
    }
  }
  if (ent.canPresentMonthly) out.push("A monthly presentation slot to the iCFO investor network");
  else if (plan === "founder_basic") out.push("Founder Spotlight at iCFO investor events");
  if (ent.canAddCompany) out.push("Additional company accounts");
  return out;
}

/** Open onboarding steps in order, then the rating when it hasn't been generated. */
export function welcomeNextSteps(data: Pick<WelcomeLetterData, "steps" | "crrScore">): Array<{ html: string; text: string }> {
  const open = STEP_ORDER.filter((key) => data.steps.some((s) => s.key === key && !s.done)).map((key) => STEP_COPY[key]);
  if (data.crrScore == null) open.push(CRR_STEP);
  return open;
}

export function welcomeSubject(data: Pick<WelcomeLetterData, "plan" | "firstName">): string {
  const plan = PLAN_LABELS[data.plan] ?? "iCapOS";
  return data.firstName ? `Welcome to iCapOS ${plan}, ${data.firstName}` : `Welcome to iCapOS ${plan}`;
}

/** One line for the founder's bell. */
export function welcomeBell(data: Pick<WelcomeLetterData, "plan" | "steps" | "crrScore">): { title: string; message: string } {
  const plan = PLAN_LABELS[data.plan] ?? "iCapOS";
  const next = welcomeNextSteps(data)[0];
  const tail = next ? ` Next: ${next.text.charAt(0).toLowerCase()}${next.text.slice(1).replace(/\.$/, "")}.` : " Your matched investors are ready.";
  return { title: `Welcome to iCapOS ${plan}`, message: `Your plan is active.${tail}` };
}

function row(label: string, value: string | null): string {
  if (!value) return "";
  return `<tr><td style="padding:6px 0;border-bottom:1px solid ${LINE};color:${MUTED};width:45%;">${escapeHtml(label)}</td><td style="padding:6px 0;border-bottom:1px solid ${LINE};">${escapeHtml(value)}</td></tr>`;
}

function heading(text: string): string {
  return `<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};font-weight:bold;margin:22px 0 8px;">${escapeHtml(text)}</div>`;
}

/** Table based button so Gmail and Outlook show it. */
function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr><td bgcolor="${BLUE}" style="border-radius:8px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 18px;font-family:${FONT};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

export function renderWelcomeLetter(data: WelcomeLetterData, conn: FounderConnectionConfig): { subject: string; html: string; text: string } {
  const plan = PLAN_LABELS[data.plan] ?? "iCapOS";
  const subject = welcomeSubject(data);
  const greetingName = data.firstName ?? "there";
  const features = planFeatures(data.plan, conn);
  const steps = welcomeNextSteps(data);
  const started = data.startedAt
    ? formatPlatformDateTime(data.startedAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).replace(/(\d{4}),/, "$1 at")
    : null;
  const renews = data.renewsAt ? formatPlatformDateTime(data.renewsAt, { month: "short", day: "numeric", year: "numeric" }).replace(/ PT$/, "") : null;
  const button = steps.length
    ? { label: "Continue onboarding", url: absoluteUrl("/founder/onboarding") }
    : { label: "Open matches", url: absoluteUrl("/founder/matches") };

  const band = `<div style="background:${NAVY};color:#ffffff;padding:22px 24px;border-radius:10px 10px 0 0;"><div style="font-weight:bold;font-size:15px;opacity:.9;">iCapOS</div><div style="font-size:22px;font-weight:bold;margin:14px 0 4px;">Welcome aboard, ${escapeHtml(greetingName)}.</div>${
    data.companyName ? `<div style="font-size:14px;opacity:.85;">${escapeHtml(data.companyName)} is now on the ${escapeHtml(plan)} plan.</div>` : ""
  }</div>`;

  const receipt = `<div style="border:1px solid ${LINE};border-radius:10px;padding:14px 16px;margin:16px 0;"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};font-weight:bold;margin-bottom:6px;">Your plan</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">${row("Plan", plan)}${row("Amount", `${money(data.priceCents)} / month`)}${row("Started", started)}${row("Next renewal", renews)}</table></div>`;

  const featureList = features
    .map((f) => `<div style="padding:5px 0;"><span style="color:${GREEN};font-weight:bold;">&#10003;</span>&nbsp; ${escapeHtml(f)}</div>`)
    .join("");

  const finish = steps.length === 1 ? "This step finishes it." : steps.length === 2 ? "These two steps finish it." : steps.length === 3 ? "These three steps finish it." : "These steps finish it.";
  const progress =
    steps.length && data.onboardingPercent != null && data.onboardingPercent < 100 ? `Your onboarding is ${data.onboardingPercent}% complete. ${finish}` : null;
  const stepList = steps.length
    ? `${heading("Your next steps")}<ol style="margin:0;padding-left:20px;">${steps.map((s) => `<li style="margin:6px 0;">${s.html}</li>`).join("")}</ol>${
        progress ? `<p style="margin:10px 0 0;color:#475569;">${escapeHtml(progress)}</p>` : ""
      }`
    : `${heading("Your next step")}<p style="margin:0;">Your onboarding is complete. Your matched investors are ready to review.</p>`;

  const html = `<div style="font-family:${FONT};font-size:14px;line-height:1.6;color:#0F172A;max-width:600px;">${band}<div style="padding:22px 24px 26px;border:1px solid ${LINE};border-top:0;border-radius:0 0 10px 10px;"><p style="margin:0 0 12px;">Dear ${escapeHtml(greetingName)},</p><p style="margin:0;">Thank you for choosing iCapOS. Your payment went through and your ${escapeHtml(plan)} plan is active. Our team has been notified and will reach out to welcome you personally.</p>${receipt}${heading("What your plan includes")}${featureList}${stepList}${emailButton(button.label, button.url)}<p style="margin:22px 0 0;">Questions? Just reply to this email and our team will help.<br><br>Welcome,<br><b>Khris Thetsy</b><br>Founder &amp; CEO, iCFO Capital Global, Inc.</p><div style="margin-top:22px;padding-top:14px;border-top:1px solid ${LINE};font-size:11.5px;color:#94A3B8;line-height:1.5;">${escapeHtml(DISCLAIMER)} You are receiving this email because you subscribed to iCapOS. Manage billing from Settings in your iCapOS account.</div></div></div>`;

  const text = [
    `Welcome aboard, ${greetingName}.`,
    data.companyName ? `${data.companyName} is now on the ${plan} plan.` : null,
    "",
    `Dear ${greetingName},`,
    `Thank you for choosing iCapOS. Your payment went through and your ${plan} plan is active. Our team has been notified and will reach out to welcome you personally.`,
    "",
    "Your plan",
    `Plan: ${plan}`,
    `Amount: ${money(data.priceCents)} / month`,
    started ? `Started: ${started}` : null,
    renews ? `Next renewal: ${renews}` : null,
    "",
    "What your plan includes",
    ...features.map((f) => `* ${f}`),
    "",
    steps.length ? "Your next steps" : "Your next step",
    ...(steps.length ? steps.map((s, i) => `${i + 1}. ${s.text}`) : ["Your onboarding is complete. Your matched investors are ready to review."]),
    progress,
    "",
    `${button.label}: ${button.url}`,
    "",
    "Questions? Just reply to this email and our team will help.",
    "",
    "Welcome,",
    "Khris Thetsy",
    "Founder & CEO, iCFO Capital Global, Inc.",
    "",
    DISCLAIMER,
  ].filter((l) => l !== null) as string[];

  return { subject, html, text: lines(text) };
}

function lines(list: string[]): string {
  return list.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Replies open a support request when inbound mail is set up, else go to the team inbox. */
export function welcomeReplyTo(): string {
  return supportInboundEnabled() ? supportInboxAddress() : EMAIL_BRAND.fromEmail;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createServiceRoleClient();
}

export async function loadWelcomeLetterData(founderId: string, planHint?: PlanType | null): Promise<WelcomeLetterData | null> {
  const admin = db();
  const [profileRes, subRes, companyRes] = await Promise.all([
    admin.from("profiles").select("email, full_name, role").eq("id", founderId).maybeSingle(),
    admin.from("subscriptions").select("plan_type, monthly_price_cents, current_period_start, current_period_end").eq("profile_id", founderId).maybeSingle(),
    admin
      .from("companies")
      .select("id, company_name, onboarding_progress_percent, onboarding_step_state")
      .eq("founder_id", founderId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const p = profileRes.data as { email: string | null; full_name: string | null; role: string | null } | null;
  if (!p?.email) return null;
  const s = (subRes.data ?? {}) as { plan_type?: PlanType; monthly_price_cents?: number | null; current_period_start?: string | null; current_period_end?: string | null };
  const plan = (planHint ?? s.plan_type ?? null) as PlanType | null;
  if (!plan) return null;
  const priceCents = typeof s.monthly_price_cents === "number" && s.monthly_price_cents > 0 ? s.monthly_price_cents : PLAN_PRICES[plan] ?? 0;
  if (priceCents <= 0) return null;

  const c = companyRes.data as { id: string; company_name: string | null; onboarding_progress_percent: number | null; onboarding_step_state: Record<string, unknown> | null } | null;
  let crrScore: number | null = null;
  if (c?.id) {
    const { data: crr } = await admin
      .from("company_readiness_scores")
      .select("effective_score")
      .eq("company_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    crrScore = (crr as { effective_score: number | null } | null)?.effective_score ?? null;
  }
  const state = (c?.onboarding_step_state ?? {}) as Record<string, { completed?: boolean } | string>;

  return {
    founderId,
    email: p.email,
    firstName: firstNameOf(p.full_name),
    companyName: c?.company_name ?? null,
    plan,
    priceCents,
    // "Started" only for a payment in the last 2 days. A letter sent later to an
    // existing client (Send welcome letter) would otherwise show a renewal date
    // as the start.
    startedAt: startedIfRecent(s.current_period_start ?? null),
    renewsAt: s.current_period_end ?? null,
    onboardingPercent: c?.onboarding_progress_percent ?? null,
    steps: STEP_ORDER.map((key) => {
      const v = state[key];
      return { key, done: typeof v === "object" && v !== null && Boolean(v.completed) };
    }),
    crrScore,
  };
}

/** The latest welcome letter in the email log for this founder, or null. */
export async function latestWelcomeLetter(founderId: string): Promise<{
  id: number;
  createdAt: string;
  status: string;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
} | null> {
  try {
    const { data } = await db()
      .from("email_log")
      .select("id, created_at, status, delivered_at, opened_at, clicked_at, bounced_at")
      .eq("recipient_user_id", founderId)
      .eq("source", WELCOME_LETTER_SOURCE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = data as {
      id: number;
      created_at: string;
      status: string;
      delivered_at: string | null;
      opened_at: string | null;
      clicked_at: string | null;
      bounced_at: string | null;
    } | null;
    return r
      ? { id: r.id, createdAt: r.created_at, status: r.status, deliveredAt: r.delivered_at, openedAt: r.opened_at, clickedAt: r.clicked_at, bouncedAt: r.bounced_at }
      : null;
  } catch {
    return null;
  }
}

export type WelcomeSendResult = { sent: boolean; reason: string };

/**
 * Send the welcome letter. On the automatic path (`resend` false) it sends at
 * most once per founder: a letter already in the log stops it, and when two
 * checkout events race, only the earliest founder bell wins the send.
 * Never throws: a failed letter must not break billing.
 */
export async function sendFounderWelcomeLetter(input: {
  founderId: string;
  plan?: PlanType | null;
  resend?: boolean;
  triggeredBy?: string | null;
}): Promise<WelcomeSendResult> {
  try {
    const data = await loadWelcomeLetterData(input.founderId, input.plan ?? null);
    if (!data) return { sent: false, reason: "No paid plan or no founder email" };
    if (isInternalAccount({ email: data.email, role: "founder" })) return { sent: false, reason: "Internal account" };

    if (!input.resend) {
      const prior = await latestWelcomeLetter(input.founderId);
      if (prior && prior.status === "sent") return { sent: false, reason: "Already sent" };
    }

    const conn = await getFounderConnectionConfig();
    const letter = renderWelcomeLetter(data, conn);

    if (!input.resend) {
      const bell = welcomeBell(data);
      const created = await createNotification({
        recipientUserId: input.founderId,
        type: FOUNDER_WELCOME_TYPE,
        title: bell.title,
        message: bell.message,
        entityType: "profile",
        entityId: input.founderId,
        deepLink: welcomeNextSteps(data).length ? "/founder/onboarding" : "/founder/matches",
        dedupeKey: `${FOUNDER_WELCOME_TYPE}:${input.founderId}`,
      });
      // Two checkout events can arrive together. Only the earliest bell sends
      // the letter; a later duplicate bell is removed.
      if (created?.id) {
        const { data: bells } = await db()
          .from("notifications")
          .select("id, created_at")
          .eq("recipient_user_id", input.founderId)
          .eq("type", FOUNDER_WELCOME_TYPE)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(1);
        const first = ((bells ?? []) as Array<{ id: string }>)[0];
        if (first && first.id !== created.id) {
          await db().from("notifications").delete().eq("id", created.id);
          return { sent: false, reason: "Already sending" };
        }
      }
    }

    const ok = await sendEmail({
      to: data.email,
      subject: letter.subject,
      html: letter.html,
      text: letter.text,
      fromName: "Khris Thetsy, iCFO Capital Global",
      replyTo: welcomeReplyTo(),
      tags: [{ name: "kind", value: WELCOME_LETTER_SOURCE }],
      source: WELCOME_LETTER_SOURCE,
      audience: "founder",
      triggeredBy: input.triggeredBy ?? null,
    });
    return ok ? { sent: true, reason: input.resend ? "Resent" : "Sent" } : { sent: false, reason: "Email provider did not accept the send" };
  } catch (error) {
    console.warn("[founder-welcome-letter] failed", error);
    return { sent: false, reason: "Failed" };
  }
}
