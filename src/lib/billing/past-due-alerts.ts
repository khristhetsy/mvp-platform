import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, hasRecentNotification } from "@/lib/notifications/notifications";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { sendEmail } from "@/lib/email/send-email";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { renderEmail } from "@/lib/email/layout";
import { staffRecipients, newCustomerLink } from "@/lib/notifications/new-customer-alerts";
import { PLAN_LABELS, type PlanType } from "@/lib/subscriptions/plans";
import { formatPtDate, type PastDueStage } from "@/lib/billing/past-due";
import { renderFounderPastDueEmail } from "@/lib/billing/past-due-email";

export const PAST_DUE_FOUNDER_TYPE = "billing_past_due";
const STAGE_TYPE: Record<PastDueStage, string> = {
  first: PAST_DUE_FOUNDER_TYPE,
  midpoint: "billing_past_due_midpoint",
  final: "billing_past_due_final",
};
const STAGE_TITLE: Record<PastDueStage, string> = {
  first: "Your payment did not go through",
  midpoint: "Two days left to update your card",
  final: "Last day to update your card",
};
export const PAST_DUE_STAFF_TYPE = "staff_premium_payment_past_due";
const BILLING_PATH = "/founder/settings/billing";

/**
 * stage "first": called once, on the event that moves a subscription into past
 * due (day 0). Founder gets an in app notification and an email with the date
 * investor outreach pauses. Premium only: the staff are told too, so someone
 * from iCFO can reach the founder before the date.
 *
 * stage "midpoint" / "final": the daily reminder job (day 3 and day 5). Founder
 * only, once each per failed payment.
 *
 * Never throws, so a mail problem cannot fail the billing webhook or the job.
 */
export async function notifyPastDue(input: {
  profileId: string;
  subscriptionId: string;
  plan: PlanType | string;
  endsAt: string;
  stage?: PastDueStage;
}): Promise<void> {
  const stage: PastDueStage = input.stage ?? "first";
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin.from("profiles").select("email, full_name, role").eq("id", input.profileId).maybeSingle();
    const founder = data as { email: string | null; full_name: string | null; role: string | null } | null;
    if (!founder || isInternalAccount({ email: founder.email, role: founder.role })) return;

    const planLabel = PLAN_LABELS[input.plan as PlanType] ?? String(input.plan);
    const date = formatPtDate(input.endsAt);

    // Each stage goes out once per failed payment (the window is 5 days, so 6 days
    // of memory covers it and the next failure starts fresh).
    if (!(await hasRecentNotification({ recipientUserId: input.profileId, type: STAGE_TYPE[stage], entityId: input.subscriptionId, withinHours: stage === "first" ? 24 : 24 * 6 }))) {
      await createNotification({
        recipientUserId: input.profileId,
        type: STAGE_TYPE[stage],
        title: STAGE_TITLE[stage],
        message: `Update your card by ${date} to keep investor outreach running.`,
        entityType: "subscription",
        entityId: input.subscriptionId,
        deepLink: BILLING_PATH,
      });
      if (founder.email) {
        const rendered = renderFounderPastDueEmail({
          firstName: founder.full_name?.split(" ")[0] ?? null,
          planLabel,
          endsAt: input.endsAt,
          billingUrl: absoluteUrl(BILLING_PATH),
          stage,
        });
        await sendEmail({
          to: founder.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          source: "billing_past_due",
          audience: "founder",
        });
      }
    }

    if (stage !== "first" || input.plan !== "founder_premium") return;

    const { data: co } = await admin
      .from("companies")
      .select("id, company_name")
      .eq("founder_id", input.profileId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const company = co as { id: string; company_name: string | null } | null;
    const who = company?.company_name?.trim() || founder.full_name?.trim() || founder.email || "A Premium founder";
    const link = newCustomerLink(company?.id ?? null);
    const message = `${who} is on Premium and their card payment failed. Their investor outreach pauses on ${date}. Reach out so they update the card.`;

    const staff = await staffRecipients();
    await Promise.all(
      staff.map(async (person) => {
        if (await hasRecentNotification({ recipientUserId: person.id, type: PAST_DUE_STAFF_TYPE, entityId: input.subscriptionId, withinHours: 24 })) return;
        await createNotification({
          recipientUserId: person.id,
          actorUserId: input.profileId,
          type: PAST_DUE_STAFF_TYPE,
          title: "Premium payment failed",
          message,
          entityType: "subscription",
          entityId: input.subscriptionId,
          deepLink: link,
        });
        if (!person.email) return;
        const url = absoluteUrl(link);
        const rendered = renderEmail({
          audience: "admin",
          subject: `Premium payment failed: ${who}`,
          preheader: `Investor outreach pauses on ${date}.`,
          headline: "Premium payment failed",
          intro: message,
          blocks: [
            {
              type: "facts",
              rows: [
                { label: "Account", value: who },
                { label: "Founder email", value: founder.email ?? "Not on file" },
                { label: "Investor outreach pauses", value: date },
              ],
            },
          ],
          primary: { label: "Open company", url },
          footer: { reason: "Sent to admin and analyst roles when a Premium card payment fails." },
        });
        await sendEmail({
          to: person.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          source: "staff_alert:premium_past_due",
          audience: "staff",
        });
      }),
    );
  } catch (error) {
    console.warn("[past-due-alerts] failed", error);
  }
}
