import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { getOpsSettings } from "@/lib/operations/settings";
import { writeAuditLog } from "@/lib/data/audit";
import { MANAGED_ICFO_ROLE } from "@/lib/team/managed-icfo-core";
import { isStaffProfileRole, planPremiumAssignment, planReassignment } from "@/lib/team/account-manager-core";

// The generated types do not cover every table this file touches.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createServiceRoleClient();
}

async function companyForFounder(founderId: string): Promise<{ id: string; name: string } | null> {
  const { data } = await db()
    .from("companies")
    .select("id, company_name")
    .eq("founder_id", founderId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id as string, name: (data.company_name as string | null) ?? "A founder" } : null;
}

export async function listAccountManagerIds(companyId: string): Promise<string[]> {
  const { data } = await db().from("company_members").select("user_id").eq("company_id", companyId).eq("role", MANAGED_ICFO_ROLE);
  return ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
}

async function isStaff(userId: string): Promise<boolean> {
  const { data } = await db().from("profiles").select("role").eq("id", userId).maybeSingle();
  return isStaffProfileRole((data as { role?: string } | null)?.role);
}

async function adminIds(): Promise<string[]> {
  const { data } = await db().from("profiles").select("id").eq("role", "admin");
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

/**
 * Makes one iCFO staff member the account manager of a company (Managed by iCFO), or
 * clears the manager when managerId is null. Throws a readable Error when it cannot.
 */
export async function setAccountManager(input: { companyId: string; managerId: string | null; assignedBy: string | null }): Promise<void> {
  if (input.managerId && !(await isStaff(input.managerId))) throw new Error("Choose an iCFO staff member.");

  const existing = await listAccountManagerIds(input.companyId);
  const plan = planReassignment({ existingManagerIds: existing, newManagerId: input.managerId });

  if (plan.add && input.managerId) {
    const { data: current } = await db()
      .from("company_members")
      .select("role")
      .eq("company_id", input.companyId)
      .eq("user_id", input.managerId)
      .maybeSingle();
    if (current && current.role !== MANAGED_ICFO_ROLE) {
      throw new Error("That person already has another role on this company.");
    }
    const { error } = await db().from("company_members").insert({ company_id: input.companyId, user_id: input.managerId, role: MANAGED_ICFO_ROLE });
    if (error) throw new Error("Could not assign the account manager.");
  }
  if (plan.remove.length) {
    const { error } = await db().from("company_members").delete().eq("company_id", input.companyId).eq("role", MANAGED_ICFO_ROLE).in("user_id", plan.remove);
    if (error) throw new Error("Could not remove the previous account manager.");
  }

  if (input.assignedBy) {
    await writeAuditLog(createServiceRoleClient(), {
      userId: input.assignedBy,
      action: "team.account_manager_set",
      entityType: "company",
      entityId: input.companyId,
      metadata: { manager_id: input.managerId, removed: plan.remove },
    }).catch(() => undefined);
  }
}

export type PremiumAssignmentResult = "assigned" | "already_assigned" | "needs_manager" | "no_company" | "failed";

/**
 * Called when a founder starts paying for Premium (wire received or card). Gives the
 * account to the default account manager and tells that person and the admins. Never
 * throws: a payment must never fail because of this.
 */
export async function assignAccountManagerForPremium(input: { founderId: string; assignedBy?: string | null }): Promise<PremiumAssignmentResult> {
  try {
    const company = await companyForFounder(input.founderId);
    if (!company) return "no_company";

    const existing = await listAccountManagerIds(company.id);
    const settings = await getOpsSettings();
    const defaultId = settings.premiumAccountManagerId;
    const plan = planPremiumAssignment({
      existingManagerIds: existing,
      defaultManagerId: defaultId,
      defaultIsStaff: defaultId ? await isStaff(defaultId) : false,
    });

    const link = `/admin/companies/${company.id}`;
    const admins = await adminIds();

    if (plan.action === "skip") return "already_assigned";

    if (plan.action === "needs_manager") {
      await Promise.all(
        admins.map((recipientUserId) =>
          createNotification({
            recipientUserId,
            type: "premium_needs_account_manager",
            title: "Premium account needs an account manager",
            message: `${company.name} is on Premium, Done for you. Set a default account manager in Operations Hub settings, or assign one on the company page.`,
            entityType: "company",
            entityId: company.id,
            deepLink: link,
            dedupeKey: `premium_needs_manager_${company.id}`,
          }),
        ),
      );
      return "needs_manager";
    }

    await setAccountManager({ companyId: company.id, managerId: plan.managerId, assignedBy: input.assignedBy ?? null });

    await createNotification({
      recipientUserId: plan.managerId,
      type: "premium_account_assigned",
      title: "New Premium account assigned to you",
      message: `${company.name} is on Premium, Done for you. You are the account manager.`,
      entityType: "company",
      entityId: company.id,
      deepLink: link,
      dedupeKey: `premium_assigned_${company.id}_${plan.managerId}`,
    });
    await Promise.all(
      admins
        .filter((id) => id !== plan.managerId)
        .map((recipientUserId) =>
          createNotification({
            recipientUserId,
            type: "premium_account_assigned",
            title: "Premium account manager assigned",
            message: `${company.name} was assigned to its default account manager.`,
            entityType: "company",
            entityId: company.id,
            deepLink: link,
            dedupeKey: `premium_assigned_admin_${company.id}_${recipientUserId}`,
          }),
        ),
    );
    return "assigned";
  } catch (err) {
    console.warn("[account-manager] Premium assignment failed", err);
    return "failed";
  }
}
