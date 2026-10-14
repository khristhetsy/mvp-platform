/**
 * Shared guard for every founder social media API route and page.
 * Founder only, plan must include social media, and every row a route touches is
 * checked against the founder's own id here (the tables are service role only).
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getFounderSocialUsage } from "@/lib/social/founder-limits";
import type { SocialUsage } from "@/lib/social/usage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function socialDb(): any { return createServiceRoleClient(); }

export type FounderSocialAuth = { founderId: string; profile: { id: string; full_name: string | null; email: string | null }; usage: SocialUsage };

export async function requireFounderSocial(): Promise<FounderSocialAuth | { error: Response }> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return { error: NextResponse.json({ error: "Founders only." }, { status: 403 }) };
  const usage = await getFounderSocialUsage(profile.id).catch(() => null);
  if (!usage || !usage.enabled) {
    return { error: NextResponse.json({ error: "Social media is not included in your plan.", code: "plan" }, { status: 403 }) };
  }
  return { founderId: profile.id, profile: profile as FounderSocialAuth["profile"], usage };
}

/** True when every id is a social_accounts row owned by this founder. */
export async function ownsAccounts(founderId: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return false;
  const { data } = await socialDb().from("social_accounts").select("id").eq("owner_profile_id", founderId).neq("status", "disconnected").in("id", ids);
  return ((data ?? []) as unknown[]).length === new Set(ids).size;
}

export async function ownsCampaign(founderId: string, id: string): Promise<boolean> {
  const { data } = await socialDb().from("social_campaigns").select("id").eq("id", id).eq("owner_profile_id", founderId).maybeSingle();
  return Boolean(data);
}

export async function ownsPost(founderId: string, id: string): Promise<boolean> {
  const { data } = await socialDb().from("social_posts").select("id").eq("id", id).eq("owner_profile_id", founderId).maybeSingle();
  return Boolean(data);
}
