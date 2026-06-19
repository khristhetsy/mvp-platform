import { createNotification } from "@/lib/notifications/notifications";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function notifyInvestorsOfCompanyUpdate(input: {
  companyId: string;
  updateId: string;
  title: string;
  visibility: string;
  founderId: string;
}) {
  const admin = createServiceRoleClient();
  const { data: company } = await admin
    .from("companies")
    .select("company_name, slug")
    .eq("id", input.companyId)
    .maybeSingle();

  const companyName = company?.company_name ?? "A company you follow";
  const deepLink = company?.slug
    ? `/deals/${company.slug}`
    : "/investor/opportunities";
  const recipientIds = new Set<string>();

  const [interests, intros, saved, threads] = await Promise.all([
    admin.from("investor_interests").select("investor_id").eq("company_id", input.companyId),
    admin.from("intro_requests").select("investor_id").eq("company_id", input.companyId),
    admin.from("saved_deals").select("investor_id").eq("company_id", input.companyId),
    admin.from("message_threads").select("investor_id").eq("company_id", input.companyId),
  ]);

  for (const row of interests.data ?? []) {
    recipientIds.add(row.investor_id);
  }
  for (const row of intros.data ?? []) {
    recipientIds.add(row.investor_id);
  }
  for (const row of saved.data ?? []) {
    recipientIds.add(row.investor_id);
  }
  for (const row of threads.data ?? []) {
    recipientIds.add(row.investor_id);
  }

  if (input.visibility === "marketplace") {
    const { data: approvedInvestors } = await admin
      .from("investor_profiles")
      .select("profile_id")
      .eq("approval_status", "approved");
    for (const row of approvedInvestors ?? []) {
      recipientIds.add(row.profile_id);
    }
  }

  recipientIds.delete(input.founderId);

  const message =
    input.visibility === "marketplace"
      ? `${companyName} published a marketplace update: ${input.title}`
      : `${companyName} shared an investor update: ${input.title}`;

  await Promise.all(
    [...recipientIds].map((recipientUserId) =>
      createNotification({
        recipientUserId,
        actorUserId: input.founderId,
        type: "company_update_published",
        title: "Company update published",
        message,
        entityType: "company_update",
        entityId: input.updateId,
        deepLink,
        dedupeKey: `company_update:${input.updateId}:${recipientUserId}`,
      }),
    ),
  );
}
