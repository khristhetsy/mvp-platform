import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { NotificationRecord, NotificationType } from "@/lib/notifications/types";

export type CreateNotificationInput = {
  recipientUserId: string;
  actorUserId?: string | null;
  type: NotificationType | string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("notifications")
      .insert({
        recipient_user_id: input.recipientUserId,
        actor_user_id: input.actorUserId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return null;
    }

    return data as NotificationRecord;
  } catch {
    return null;
  }
}

export async function listStaffProfileIds() {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("id").in("role", ["admin", "analyst"]);
  return (data ?? []).map((row) => row.id);
}

export async function notifyStaff(input: Omit<CreateNotificationInput, "recipientUserId">) {
  const staffIds = await listStaffProfileIds();
  await Promise.all(staffIds.map((recipientUserId) => createNotification({ ...input, recipientUserId })));
}

export async function getCompanyFounderId(companyId: string) {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("companies").select("founder_id, company_name").eq("id", companyId).maybeSingle();
  return data ?? null;
}

export async function notifyCompanyFounder(
  companyId: string,
  input: Omit<CreateNotificationInput, "recipientUserId">,
) {
  const company = await getCompanyFounderId(companyId);
  if (!company?.founder_id) {
    return null;
  }

  return createNotification({
    ...input,
    recipientUserId: company.founder_id,
  });
}

export async function listUserNotifications(userId: string, limit = 50) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load notifications: ${error.message}`);
  }

  return (data ?? []) as NotificationRecord[];
}

export async function countUnreadNotifications(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(`Failed to count notifications: ${error.message}`);
  }

  return count ?? 0;
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("recipient_user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark notification read: ${error.message}`);
  }

  return (data as NotificationRecord | null) ?? null;
}

export async function markAllNotificationsRead(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(`Failed to mark all notifications read: ${error.message}`);
  }
}

export async function hasRecentNotification(input: {
  recipientUserId: string;
  type: string;
  entityId?: string | null;
  withinHours?: number;
}) {
  const admin = createServiceRoleClient();
  const since = new Date(Date.now() - (input.withinHours ?? 24) * 60 * 60 * 1000).toISOString();

  let query = admin
    .from("notifications")
    .select("id")
    .eq("recipient_user_id", input.recipientUserId)
    .eq("type", input.type)
    .gte("created_at", since)
    .limit(1);

  if (input.entityId) {
    query = query.eq("entity_id", input.entityId);
  }

  const { data } = await query;
  return (data ?? []).length > 0;
}
