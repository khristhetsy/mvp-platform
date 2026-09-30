/**
 * Feature flag for Match campaigns. Off unless MATCH_CAMPAIGNS_ENABLED=true, so
 * merging the branch changes nothing until the flag is turned on.
 */
export function matchCampaignsEnabled(): boolean {
  return process.env.MATCH_CAMPAIGNS_ENABLED === "true";
}
