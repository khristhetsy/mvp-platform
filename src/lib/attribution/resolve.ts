/**
 * Turning what arrived with a booking into a campaign tag.
 *
 * The ranking itself is pure and lives in `./source`. This module is the part
 * that has to touch the database: reading a /fit session's tag, and mapping a
 * self-reported answer onto a real campaign.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { normalizeSourceTag } from "@/lib/attribution/source";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/**
 * The campaign tag behind a /fit session.
 *
 * Read directly rather than waiting for `handoffFitSession`, because the
 * handoff runs after the booking is written and only updates the CONTACT. The
 * booking needs the tag at insert time, and this is the highest-confidence
 * signal so it must be available before the ladder is applied.
 */
export async function fitSessionTag(sessionId: string | null | undefined): Promise<string | null> {
  if (!sessionId) return null;
  try {
    const { data } = await db()
      .from("fit_sessions")
      .select("source_tag")
      .eq("id", sessionId)
      .maybeSingle();
    return normalizeSourceTag((data as Record<string, unknown> | null)?.source_tag as string | null);
  } catch {
    return null;
  }
}

/** A campaign as the self-report picklist needs to see it. */
export type CampaignOption = { id: string; name: string; sourceTag: string };

/** Live campaigns, for the booking form's "How did you hear about us?" list. */
export async function listCampaignOptions(): Promise<CampaignOption[]> {
  try {
    const { data } = await db()
      .from("social_campaigns")
      .select("id, name, source_tag")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    return ((data ?? []) as Array<Record<string, unknown>>)
      .map((r) => ({
        id: String(r.id),
        name: String(r.name ?? ""),
        sourceTag: normalizeSourceTag(r.source_tag as string | null) ?? "",
      }))
      .filter((c) => c.sourceTag && c.name);
  } catch {
    return [];
  }
}

/**
 * Map a self-reported answer to a campaign tag.
 *
 * The old booking code wrote the raw answer — `"LinkedIn"` — straight into
 * `lead_source` and the funnel compared it to `linkedin-icapos-sept`. That
 * never matched, which is most of why Meetings read zero. So the answer is
 * matched against real campaigns and anything that does not resolve is
 * discarded rather than stored as a tag that means nothing.
 *
 * Exact tag first, then exact name, then a channel prefix — `"LinkedIn"` maps
 * to a `linkedin-…` campaign only when exactly one exists, because guessing
 * between two LinkedIn campaigns would silently misattribute revenue.
 */
export function matchCampaignAnswer(
  answer: string | null | undefined,
  campaigns: CampaignOption[],
): string | null {
  const raw = (answer ?? "").trim().toLowerCase();
  if (!raw || !campaigns.length) return null;

  const exactTag = campaigns.find((c) => c.sourceTag === raw);
  if (exactTag) return exactTag.sourceTag;

  const exactName = campaigns.find((c) => c.name.trim().toLowerCase() === raw);
  if (exactName) return exactName.sourceTag;

  // Channel-only answers ("LinkedIn") are ambiguous the moment there are two
  // campaigns on that channel. One match is a fair inference; two is a coin
  // toss, and a coin toss in a revenue number is worse than an honest blank.
  const slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return null;
  const prefixed = campaigns.filter((c) => c.sourceTag.startsWith(`${slug}-`) || c.sourceTag === slug);
  return prefixed.length === 1 ? prefixed[0].sourceTag : null;
}

/** The booking form question this reads. Matched loosely — staff word it freely. */
export const HEARD_ABOUT_PATTERN = /how did you hear|hear about|where did you find/i;

/** Pull the "how did you hear" answer out of a booking's answers array. */
export function heardAboutAnswer(
  answers: Array<{ label: string; value: string }> | undefined,
): string | null {
  const hit = (answers ?? []).find((a) => HEARD_ABOUT_PATTERN.test(a.label));
  return hit?.value?.trim() || null;
}
