import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function listPublishedCampaigns(supabase: SupabaseClient<Database>) {
  return supabase.from("campaigns").select("*, companies(*)").eq("status", "published").order("created_at", { ascending: false });
}

export async function publishCampaign(supabase: SupabaseClient<Database>, campaignId: string) {
  return supabase
    .from("campaigns")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", campaignId)
    .select("*")
    .single();
}
