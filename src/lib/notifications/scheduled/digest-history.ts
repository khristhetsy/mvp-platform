import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduledDigest } from "@/lib/notifications/scheduled/types";
import type { Database } from "@/lib/supabase/types";

export async function getLastDigestRunAt(
  supabase: SupabaseClient<Database>,
  digestType: string,
  userId?: string | null,
): Promise<string | null> {
  let query = supabase
    .from("scheduled_digest_runs")
    .select("generated_at")
    .eq("digest_type", digestType)
    .order("generated_at", { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.is("user_id", null);
  }

  const { data } = await query.maybeSingle();
  return data?.generated_at ?? null;
}

export async function persistScheduledDigest(
  supabase: SupabaseClient<Database>,
  digest: ScheduledDigest,
): Promise<string | null> {
  const severity =
    digest.counts.critical > 0 ? "critical" : digest.counts.overdue > 0 ? "high" : "info";

  const { data: run, error } = await supabase
    .from("scheduled_digest_runs")
    .insert({
      digest_type: digest.digestType,
      user_id: digest.userId ?? null,
      item_count: digest.counts.total,
      severity,
      delivery_status: "delivered",
      metadata: {
        title: digest.title,
        attention_areas: digest.attentionAreas,
        counts: digest.counts,
        primary_deep_link: digest.primaryDeepLink,
      },
    })
    .select("id")
    .single();

  if (error || !run) return null;

  let sortOrder = 0;
  const items: Database["public"]["Tables"]["scheduled_digest_items"]["Insert"][] = [];

  for (const section of digest.sections) {
    for (const item of section.items) {
      if (items.length >= 50) break;
      items.push({
        run_id: run.id,
        section: section.key,
        title: item.title.slice(0, 200),
        severity: item.severity,
        deep_link: item.deepLink ?? null,
        action_id: item.actionId ?? null,
        sort_order: sortOrder++,
      });
    }
  }

  if (items.length) {
    await supabase.from("scheduled_digest_items").insert(items);
  }

  return run.id;
}

export async function deliverDigestReadyNotification(
  supabase: SupabaseClient<Database>,
  digest: ScheduledDigest,
  recipientUserId: string,
) {
  const dedupeKey = `digest_ready:${digest.digestType}:${recipientUserId}:${digest.generatedAt.slice(0, 10)}`;

  const { data: recent } = await supabase
    .from("notifications")
    .select("id")
    .eq("recipient_user_id", recipientUserId)
    .eq("dedupe_key", dedupeKey)
    .limit(1);

  if ((recent ?? []).length > 0) return;

  await supabase.from("notifications").insert({
    recipient_user_id: recipientUserId,
    type: "digest_ready",
    title: digest.title.slice(0, 200),
    message: `${digest.counts.total} workflow item(s) in your digest. Open Action Center for details.`,
    severity: digest.counts.critical > 0 ? "critical" : "info",
    orchestration_type: "digest_ready",
    deep_link: digest.primaryDeepLink,
    dedupe_key: dedupeKey,
  });
}
