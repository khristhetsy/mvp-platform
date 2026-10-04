/**
 * Daily rematch for Match campaigns. Every campaign with daily_rematch on gets
 * its founders not yet emailed matched again (runCampaignMatching: pending
 * founders only, admin removals kept), so new investors and investors hidden
 * from founders are picked up before the next day's sends. The investor
 * network is loaded once for the whole run. Server only.
 */
import { marketingDb } from "@/lib/marketing/db";
import { loadMatchingShared, runCampaignMatching, updateMatchCampaign } from "./store";

export type RematchResult = { campaigns: number; founders: number; finished: number; stoppedEarly: boolean };

/** Campaign ids with the daily rematch on that may still have founders to email. */
async function rematchCampaignIds(): Promise<string[]> {
  const { data, error } = await marketingDb()
    .from("marketing_campaigns")
    .select("id, status")
    .not("match_config", "is", null)
    .eq("match_config->>daily_rematch", "true")
    .neq("status", "sent")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string }>).map((c) => c.id);
}

/** Runs until done or `deadline` (ms epoch); a campaign cut short is redone in full the next day. */
export async function runDailyRematch(deadline: number): Promise<RematchResult> {
  const ids = await rematchCampaignIds();
  const result: RematchResult = { campaigns: ids.length, founders: 0, finished: 0, stoppedEarly: false };
  if (!ids.length) return result;
  const shared = await loadMatchingShared();
  for (const id of ids) {
    let after: string | null = null;
    let done = false;
    while (Date.now() < deadline) {
      const run = await runCampaignMatching(id, { after, shared });
      result.founders += run.processed;
      if (!run.next) {
        done = true;
        break;
      }
      after = run.next;
    }
    if (!done) {
      result.stoppedEarly = true;
      break;
    }
    await updateMatchCampaign(id, { config: { last_rematch_at: new Date().toISOString() } });
    result.finished++;
  }
  return result;
}
