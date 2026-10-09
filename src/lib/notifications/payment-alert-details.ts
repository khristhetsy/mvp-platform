import { createServiceRoleClient } from "@/lib/supabase/admin";
import { escapeHtml } from "@/lib/activity/email-templates";
import { formatPlatformDateTime } from "@/lib/time/platform-tz";

/**
 * The detailed "New paying customer" staff email: payment, founder, company,
 * where they are in onboarding, and suggested next steps. Every value comes
 * from fields already stored; a section or row with no data is left out.
 */
export type PaymentAlertDetails = {
  founderName: string | null;
  founderEmail: string | null;
  phone: string | null;
  signedUpAt: string | null;
  paidAt: string;
  priceCents: number | null;
  currency: string | null;
  renewsAt: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  industry: string | null;
  location: string | null;
  operatingStage: string | null;
  fundingStage: string | null;
  capitalAmount: string | null;
  goal: string | null;
  seekingCapital: string | null;
  seekingInvestors: string | null;
  approvedAt: string | null;
  published: boolean;
  onboardingPercent: number | null;
  steps: Array<{ label: string; done: boolean }>;
  crrScore: number | null;
};

const STEP_LABELS: Array<[string, string]> = [
  ["company_profile", "Company profile"],
  ["investor_readiness_review", "Investor readiness review"],
  ["documents_uploaded", "Documents uploaded"],
  ["funding_information", "Funding information"],
];

const GREEN = "#16A34A";
const AMBER = "#B45309";
const MUTED = "#64748B";
const LINE = "#E2E8F0";
const BLUE = "#1A6CE4";
const FONT = "Helvetica, Arial, sans-serif";

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** "Other, Series A, Seed" → "Seed, Series A" (drops Other, keeps the stage order). */
export function cleanFundingStage(value: string | null): string | null {
  if (!value) return null;
  const order = ["Pre-seed", "Pre seed", "Seed", "Series A", "Series B", "Series C", "Growth"];
  const parts = value.split(",").map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== "other");
  parts.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return parts.length ? parts.join(", ") : null;
}

/** "$1m - $10m" → "$1m to $10m" (no dashes in copy). */
function noDash(value: string | null): string | null {
  return value ? value.replace(/\s*[-–—]\s*/g, " to ") : null;
}

function money(cents: number | null, currency: string | null): string | null {
  if (cents == null) return null;
  const amount = (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency && currency.toUpperCase() !== "USD" ? `${amount} ${currency.toUpperCase()}` : `$${amount}`;
}

function shortMoney(cents: number | null): string | null {
  if (cents == null) return null;
  const v = cents / 100;
  return `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

function day(value: string): string {
  return formatPlatformDateTime(value, { month: "short", day: "numeric" }).replace(/ PT$/, "");
}

function dayTime(value: string): string {
  return formatPlatformDateTime(value, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fullDayTime(value: string): string {
  return formatPlatformDateTime(value, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).replace(/(\d{4}),/, "$1 at");
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

/** Suggested next steps, built from what is still open. */
export function nextSteps(d: PaymentAlertDetails): string[] {
  const out = ["Welcome call within 24 hours."];
  const open = (label: string) => d.steps.some((s) => s.label === label && !s.done);
  if (open("Documents uploaded")) out.push("Help upload documents (the CRR needs them).");
  if (open("Funding information") && d.crrScore == null) out.push("Finish funding information, then run the CRR.");
  else if (open("Funding information")) out.push("Finish funding information.");
  else if (d.crrScore == null) out.push("Run the CRR.");
  return out;
}

/** One line for the bell: "paid $49/mo for Basic · Cleantech · Onboarding 50%". */
export function paymentBellMessage(who: string, plan: string | null, d: PaymentAlertDetails | null): string {
  if (!d) return plan ? `${who} paid for ${plan}.` : `${who} completed a payment.`;
  const price = shortMoney(d.priceCents);
  const head = plan ? `${who} paid ${price ? `${price}/mo ` : ""}for ${plan}` : `${who} completed a payment`;
  const bits = [head];
  if (d.industry) bits.push(d.industry);
  if (d.onboardingPercent != null) bits.push(`Onboarding ${d.onboardingPercent}%`);
  return bits.join(" · ");
}

export function paymentSubjectSuffix(plan: string | null, d: PaymentAlertDetails | null): string {
  const price = shortMoney(d?.priceCents ?? null);
  if (!plan) return "";
  return price ? ` · ${plan} ${price}/mo` : ` · ${plan}`;
}

function row(label: string, value: string | null): string {
  if (!value) return "";
  return `<tr><td style="padding:7px 0;border-bottom:1px solid ${LINE};color:${MUTED};width:42%;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:7px 0;border-bottom:1px solid ${LINE};vertical-align:top;">${escapeHtml(value)}</td></tr>`;
}

function section(title: string, body: string): string {
  if (!body) return "";
  return `<div style="margin-top:20px;"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};font-weight:bold;margin:0 0 8px;">${escapeHtml(title)}</div>${body}</div>`;
}

function table(rows: string): string {
  return rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">${rows}</table>` : "";
}

/** Table-wrapped button: renders in Gmail and Outlook. */
function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr><td bgcolor="${BLUE}" style="border-radius:8px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;font-family:${FONT};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

export function renderPaymentAlertEmail(input: {
  companyName: string;
  plan: string | null;
  details: PaymentAlertDetails;
  url: string;
}): { html: string; text: string } {
  const d = input.details;
  const who = d.founderName || d.founderEmail || "The founder";
  const paidLine = `${who} paid${input.plan ? ` for ${input.plan}` : ""} on ${fullDayTime(d.paidAt)}.`;
  const pills = [
    d.priceCents != null ? `<b>${escapeHtml(money(d.priceCents, d.currency) ?? "")}</b> / month` : null,
    "First payment",
    d.renewsAt ? `Renews ${escapeHtml(dayTime(d.renewsAt))}` : null,
  ]
    .filter(Boolean)
    .map((p) => `<span style="display:inline-block;background:#ffffff;border:1px solid #BBF7D0;border-radius:999px;padding:5px 10px;font-size:12px;margin:10px 8px 0 0;">${p}</span>`)
    .join("");

  const hero = `<div style="border:1px solid #BBF7D0;background:#F0FDF4;border-radius:10px;padding:16px;"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${GREEN};font-weight:bold;">New paying customer</div><div style="font-size:20px;font-weight:bold;margin:6px 0 2px;">${escapeHtml(input.companyName)}</div><div style="font-size:14px;color:#334155;">${escapeHtml(paidLine)}</div>${pills}</div>`;

  const signedUp = d.signedUpAt
    ? `${dayTime(d.signedUpAt)}${(() => {
        const n = daysBetween(d.signedUpAt, d.paidAt);
        return n >= 1 ? ` (paid ${n} day${n === 1 ? "" : "s"} later)` : " (paid the same day)";
      })()}`
    : null;
  const founder = table(row("Name", d.founderName) + row("Email", d.founderEmail) + row("Phone", d.phone) + row("Signed up", signedUp));

  const capital = [d.capitalAmount, d.goal ? `goal: ${d.goal}` : null].filter(Boolean).join(" · ") || null;
  const seeking = d.seekingCapital || d.seekingInvestors
    ? [d.seekingCapital, d.seekingInvestors ? `from ${d.seekingInvestors.toLowerCase()}` : null].filter(Boolean).join(" ")
    : null;
  const profile = d.approvedAt ? `Approved${d.published ? " and published on marketplace" : ""} ${day(d.approvedAt)}` : null;
  const company = table(
    row("Industry", d.industry) +
      row("Location", d.location) +
      row("Operating stage", d.operatingStage) +
      row("Funding stage", d.fundingStage) +
      row("Amount of capital", capital) +
      row("Seeking", seeking) +
      row("Profile", profile),
  );

  const stepRows = [
    ...d.steps,
    { label: `Capital Readiness Rating${d.crrScore == null ? ": not generated yet" : `: ${d.crrScore}`}`, done: d.crrScore != null },
  ]
    .map((s) => `<div style="padding:5px 0;font-size:14px;"><span style="color:${s.done ? GREEN : AMBER};font-weight:bold;">${s.done ? "&#10003;" : "&#9675;"}</span>&nbsp; ${escapeHtml(s.label)}</div>`)
    .join("");
  const pct = d.onboardingPercent;
  const bar = pct != null
    ? `<div style="font-size:14px;">Onboarding <b>${pct}%</b></div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;"><tr><td style="background:${LINE};border-radius:99px;height:8px;line-height:8px;font-size:0;"><div style="width:${Math.max(0, Math.min(100, pct))}%;background:${BLUE};height:8px;border-radius:99px;"></div></td></tr></table>`
    : "";
  const where = bar + stepRows;

  const steps = nextSteps(d);
  const todo = `<div style="margin-top:20px;background:#F8FAFC;border:1px solid ${LINE};border-radius:10px;padding:12px 14px;font-size:14px;"><b>Suggested next steps</b><ol style="margin:6px 0 0 18px;padding:0;">${steps.map((s) => `<li style="margin:5px 0;">${escapeHtml(s)}</li>`).join("")}</ol></div>`;

  const ids = [d.subscriptionId ? `Subscription ${d.subscriptionId}` : null, d.customerId ? `Lemon Squeezy customer ${d.customerId}` : null].filter(Boolean).join(" · ");
  const foot = `<div style="margin-top:22px;font-size:12px;color:#94A3B8;line-height:1.5;">${ids ? `${escapeHtml(ids)}<br>` : ""}Payment alerts always send, even during quiet hours. Signup and onboarding alerts follow your Notifications settings, "New founder signup".</div>`;

  const html = `<div style="font-family:${FONT};font-size:14px;color:#0F172A;max-width:600px;">${hero}${section("Founder", founder)}${section("Company", company)}${section("Where they are", where)}${todo}${emailButton("Open company", input.url)}${foot}</div>`;

  const lines = [
    "New paying customer",
    input.companyName,
    paidLine,
    d.priceCents != null ? `${money(d.priceCents, d.currency)} / month · First payment${d.renewsAt ? ` · Renews ${dayTime(d.renewsAt)}` : ""}` : null,
    "",
    "Founder",
    d.founderName ? `Name: ${d.founderName}` : null,
    d.founderEmail ? `Email: ${d.founderEmail}` : null,
    d.phone ? `Phone: ${d.phone}` : null,
    signedUp ? `Signed up: ${signedUp}` : null,
    "",
    "Company",
    d.industry ? `Industry: ${d.industry}` : null,
    d.location ? `Location: ${d.location}` : null,
    d.operatingStage ? `Operating stage: ${d.operatingStage}` : null,
    d.fundingStage ? `Funding stage: ${d.fundingStage}` : null,
    capital ? `Amount of capital: ${capital}` : null,
    seeking ? `Seeking: ${seeking}` : null,
    profile ? `Profile: ${profile}` : null,
    "",
    pct != null ? `Onboarding ${pct}%` : null,
    ...d.steps.map((s) => `${s.done ? "[x]" : "[ ]"} ${s.label}`),
    `${d.crrScore != null ? "[x]" : "[ ]"} Capital Readiness Rating${d.crrScore == null ? ": not generated yet" : `: ${d.crrScore}`}`,
    "",
    "Suggested next steps",
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Open company: ${input.url}`,
  ].filter((l) => l !== null) as string[];

  return { html, text: lines.join("\n").replace(/\n{3,}/g, "\n\n") };
}

/** Reads everything the payment email shows. Returns null when the company can't be read. */
export async function loadPaymentAlertDetails(founderId: string, companyId: string | null): Promise<PaymentAlertDetails | null> {
  if (!companyId) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    const [companyRes, subRes, profileRes, crrRes] = await Promise.all([
      admin
        .from("companies")
        .select("industry, state, country, operating_stage, funding_stage, funding_amount_band, founder_goals, seeking_capital_types, seeking_investor_types, approved_at, is_published, onboarding_progress_percent, onboarding_step_state, contact_phone")
        .eq("id", companyId)
        .maybeSingle(),
      admin.from("subscriptions").select("monthly_price_cents, currency, current_period_start, current_period_end, ls_subscription_id, ls_customer_id").eq("profile_id", founderId).maybeSingle(),
      admin.from("profiles").select("full_name, email, created_at").eq("id", founderId).maybeSingle(),
      admin.from("company_readiness_scores").select("effective_score").eq("company_id", companyId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const c = companyRes.data as Record<string, unknown> | null;
    if (!c) return null;
    const s = (subRes.data ?? {}) as Record<string, unknown>;
    const p = (profileRes.data ?? {}) as Record<string, unknown>;
    const crr = crrRes.data as { effective_score: number | null } | null;
    const stepState = (c.onboarding_step_state ?? {}) as Record<string, { completed?: boolean } | string>;
    const goal = clean(c.founder_goals)?.replace(/^looking to close:\s*\$?(?=\d)/i, "close $").replace(/^looking to close:\s*/i, "close ") ?? null;
    const location = [clean(c.state), clean(c.country)].filter(Boolean).join(", ") || null;

    return {
      founderName: clean(p.full_name),
      founderEmail: clean(p.email),
      phone: clean(c.contact_phone),
      signedUpAt: clean(p.created_at),
      paidAt: clean(s.current_period_start) ?? new Date().toISOString(),
      priceCents: typeof s.monthly_price_cents === "number" ? s.monthly_price_cents : null,
      currency: clean(s.currency),
      renewsAt: clean(s.current_period_end),
      subscriptionId: clean(s.ls_subscription_id),
      customerId: clean(s.ls_customer_id),
      industry: clean(c.industry),
      location,
      operatingStage: clean(c.operating_stage)?.replace(/-/g, " ") ?? null,
      fundingStage: cleanFundingStage(clean(c.funding_stage)),
      capitalAmount: noDash(clean(c.funding_amount_band)),
      goal,
      seekingCapital: clean(c.seeking_capital_types),
      seekingInvestors: clean(c.seeking_investor_types)?.replace(/,?\s*Other\b/i, "").replace(/^,\s*/, "") || null,
      approvedAt: clean(c.approved_at),
      published: Boolean(c.is_published),
      onboardingPercent: typeof c.onboarding_progress_percent === "number" ? c.onboarding_progress_percent : null,
      steps: STEP_LABELS.map(([key, label]) => {
        const v = stepState[key];
        return { label, done: typeof v === "object" && v !== null && Boolean(v.completed) };
      }),
      crrScore: crr?.effective_score ?? null,
    };
  } catch (error) {
    console.warn("[payment-alert-details] failed", error);
    return null;
  }
}
