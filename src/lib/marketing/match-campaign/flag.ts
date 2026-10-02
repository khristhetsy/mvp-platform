/**
 * Feature flag for Match campaigns. Off unless MATCH_CAMPAIGNS_ENABLED=true, so
 * merging the branch changes nothing until the flag is turned on.
 */
export function matchCampaignsEnabled(): boolean {
  return process.env.MATCH_CAMPAIGNS_ENABLED === "true";
}

/**
 * Follow up sequence for Match campaigns. Off unless MATCH_SEQUENCE_ENABLED=true
 * (and Match campaigns are on). Off: no Sequence step, no cohorts, Day 0 email
 * unchanged, no follow ups sent.
 */
export function matchSequenceEnabled(): boolean {
  return matchCampaignsEnabled() && process.env.MATCH_SEQUENCE_ENABLED === "true";
}

/** The sequence runs for this campaign: flag on and the admin turned it on. */
export function sequenceActive(cfg: { sequence_enabled: boolean }): boolean {
  return matchSequenceEnabled() && cfg.sequence_enabled;
}
