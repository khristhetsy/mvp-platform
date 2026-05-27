import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function listPublishedCampaigns(supabase: SupabaseClient<Database>) {
  return supabase.from("campaigns").select("*, companies(*)").eq("status", "published").order("created_at", { ascending: false });
}

export async function getCampaignBySlug(supabase: SupabaseClient<Database>, slug: string) {
  return supabase.from("campaigns").select("id, slug, status").eq("slug", slug).maybeSingle();
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export async function publishCampaign(supabase: SupabaseClient<Database>, campaignId: string) {
  return supabase
    .from("campaigns")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", campaignId)
    .select("*")
    .single();
}
