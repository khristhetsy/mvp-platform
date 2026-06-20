import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadTipPreference } from "@/lib/tips/preferences";
import { selectTip, tipDateKey } from "@/lib/tips/select";
import type { InvestorTipState, TipAudience } from "@/lib/tips/library";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/founder-journey/types";
import { TipOfTheDayCard } from "./TipOfTheDayCard";

async function resolveFounderStage(
  supabase: SupabaseClient,
  profileId: string,
): Promise<JourneyStage | undefined> {
  const result = await supabase
    .from("profiles")
    .select("journey_stage")
    .eq("id", profileId)
    .maybeSingle();
  const { data } = result as { data: { journey_stage?: string | null } | null };
  const stage = data?.journey_stage ?? undefined;
  return stage && (JOURNEY_STAGES as readonly string[]).includes(stage)
    ? (stage as JourneyStage)
    : undefined;
}

/**
 * Server wrapper: loads the user's tip preference, picks the contextual tip of
 * the day, and renders it — or nothing if tips are off or dismissed for today.
 */
export async function TipOfTheDay({
  profileId,
  audience,
  founderStage,
  investorState,
}: Readonly<{
  profileId: string;
  audience: TipAudience;
  founderStage?: JourneyStage;
  investorState?: InvestorTipState;
}>) {
  const supabase = await createServerSupabaseClient();
  const pref = await loadTipPreference(supabase, profileId);
  if (!pref.showTips || pref.dismissedToday) return null;

  const stage =
    audience === "founder" && !founderStage
      ? await resolveFounderStage(supabase as unknown as SupabaseClient, profileId)
      : founderStage;

  const tip = selectTip({ audience, founderStage: stage, investorState, dateKey: tipDateKey() });
  if (!tip) return null;

  return <TipOfTheDayCard tip={tip} />;
}
