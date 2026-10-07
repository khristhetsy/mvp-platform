import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, hasRecentNotification } from "@/lib/notifications/notifications";
import { shouldSendEmail } from "@/lib/notifications/preferences";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { sendEmail } from "@/lib/email/send-email";
import { absoluteUrl, button, escapeHtml } from "@/lib/activity/email-templates";
import { PLAN_LABELS, type PlanType } from "@/lib/subscriptions/plans";

/**
 * Staff alerts for new customers. Every admin and analyst gets one in-app
 * notification (and an email, when their settings allow) per company per event.
 * All three types map to the "New founder signup" toggle in Notification
 * settings, so each staff member controls them from one row.
 */
export type NewCustomerEvent = "signup" | "payment" | "onboarding";

export const NEW_CUSTOMER_TYPES: Record<NewCustomerEvent, string> = {
  signup: "staff_new_founder_signup",
  payment: "staff_new_founder_payment",
  onboarding: "staff_founder_onboarding_completed",
};

export type NewCustomerAlertInput = {
  event: NewCustomerEvent;
  founderId: string;
  founderEmail?: string | null;
  founderName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  plan?: PlanType | null;
  /** Signup only: payment still pending for a paid plan. */
  paymentPending?: boolean;
};

export function planName(plan?: PlanType | null): string | null {
  return plan ? PLAN_LABELS[plan] ?? plan : null;
}

/** Title and one line message, shared by the bell and the email. */
export function buildNewCustomerAlert(input: NewCustomerAlertInput): { title: string; message: string } {
  const who = input.companyName?.trim() || input.founderName?.trim() || input.founderEmail?.trim() || "A new founder";
  const plan = planName(input.plan);
  if (input.event === "payment") {
    return {
      title: "New paying customer",
      message: plan ? `${who} paid for ${plan}.` : `${who} completed a payment.`,
    };
  }
  if (input.event === "onboarding") {
    return { title: "Founder onboarding completed", message: `${who} finished onboarding.` };
  }
  const parts = [`${who} signed up`];
  if (plan) parts.push(`on ${plan}`);
  let message = parts.join(" ") + ".";
  if (input.paymentPending) message += " Payment pending.";
  return { title: "New customer signup", message };
}

/** Where staff land: the company workspace, else the companies list. */
export function newCustomerLink(companyId?: string | null): string {
  return companyId ? `/admin/companies/${companyId}` : "/admin/companies";
}

async function staffRecipients(): Promise<Array<{ id: string; email: string | null }>> {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("id, email").in("role", ["admin", "analyst"]);
  return (data ?? []) as Array<{ id: string; email: string | null }>;
}

async function fillCompany(input: NewCustomerAlertInput): Promise<NewCustomerAlertInput> {
  if (input.companyId && input.companyName) return input;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("companies")
    .select("id, company_name")
    .eq("founder_id", input.founderId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const row = data as { id: string; company_name: string | null } | null;
  return { ...input, companyId: input.companyId ?? row?.id ?? null, companyName: input.companyName ?? row?.company_name ?? null };
}

async function fillFounder(input: NewCustomerAlertInput): Promise<NewCustomerAlertInput> {
  if (input.founderEmail !== undefined && input.founderName !== undefined) return input;
  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("email, full_name, role").eq("id", input.founderId).maybeSingle();
  const row = data as { email: string | null; full_name: string | null; role: string | null } | null;
  return { ...input, founderEmail: input.founderEmail ?? row?.email ?? null, founderName: input.founderName ?? row?.full_name ?? null };
}

/**
 * Never throws: a failed alert must not break signup, onboarding or billing.
 * Skips internal and test accounts (@myicfos.com).
 */
export async function alertStaffNewCustomer(raw: NewCustomerAlertInput): Promise<void> {
  try {
    let input = await fillFounder(raw);
    if (isInternalAccount({ email: input.founderEmail ?? null, role: "founder" })) return;
    input = await fillCompany(input);

    const type = NEW_CUSTOMER_TYPES[input.event];
    const { title, message } = buildNewCustomerAlert(input);
    const link = newCustomerLink(input.companyId);
    const entityId = input.companyId ?? input.founderId;
    const staff = await staffRecipients();

    await Promise.all(
      staff.map(async (person) => {
        // One alert per person, per company, per event (webhook retries and
        // repeat calls don't duplicate it).
        if (await hasRecentNotification({ recipientUserId: person.id, type, entityId, withinHours: 24 * 90 })) return;

        await createNotification({
          recipientUserId: person.id,
          actorUserId: input.founderId,
          type,
          title,
          message,
          entityType: "company",
          entityId,
          deepLink: link,
          dedupeKey: `${type}:${entityId}`,
        });

        if (!person.email) return;
        if (!(await shouldSendEmail(person.id, type))) return;
        const url = absoluteUrl(link);
        await sendEmail({
          to: person.email,
          subject: `${title}: ${input.companyName || input.founderName || input.founderEmail || "new founder"}`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;"><p><strong>${escapeHtml(title)}</strong></p><p>${escapeHtml(message)}</p>${input.founderEmail ? `<p style="color:#555;">Founder: ${escapeHtml(input.founderEmail)}</p>` : ""}<p>${button("Open company", url, true)}</p><p style="color:#888;font-size:12px;">Turn these off under Notifications, "New founder signup".</p></div>`,
          text: `${title}\n${message}\n${url}`,
          source: `staff_alert:${input.event}`,
          audience: "staff",
        });
      }),
    );
  } catch (error) {
    console.warn("[new-customer-alerts] failed", error);
  }
}
