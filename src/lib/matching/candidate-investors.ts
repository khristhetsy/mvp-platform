/**
 * Candidate investors for one founder, without scanning the whole investor network.
 *
 * The founder board and automated outreach used to read up to 3,000 wide contact rows
 * on every call and score them all. This reads a short list instead: the investors in
 * the founder's sectors (from the narrow match index, newest verified first), topped up
 * from the rest of the index, then loads only those contacts and lets the same matching
 * engine score them. Sectors prioritise who is read; the engine still decides the rank.
 *
 * Off by default (platform setting `match_prefilter`). Returns null whenever it cannot
 * fill the founder's list, so the caller falls back to the full read and a board is
 * never emptier than before.
 */
import { candidateIdsForFounder } from "@/lib/fit/match-index";
import { canonicalizeIndustries } from "@/lib/industries/canonical";
import { loadInvestorContacts, type ScoredInvestorContact } from "@/lib/investors/load-investor-matches";
import { getBoolSetting } from "@/lib/settings/platform-settings";

export const MATCH_PREFILTER_KEY = "match_prefilter";
/** Candidates read per founder before scoring. */
export const MATCH_PREFILTER_CAP = 300;

type ScoreAgainst = NonNullable<Parameters<typeof loadInvestorContacts>[0]>["scoreAgainst"];

/** The founder's industry in the index's vocabulary (empty when unset or unrecognised). */
export function founderIndustries(industry: string | null | undefined): string[] {
  return industry && industry.trim() ? canonicalizeIndustries([industry]) : [];
}

export async function loadPrefilteredInvestors(args: {
  industry: string | null | undefined;
  scoreAgainst: ScoreAgainst;
  /** Investors the caller needs to end up with (the board size). Fewer candidates means fall back. */
  want: number;
  cap?: number;
  /** Skip the setting check. Only the admin comparison uses this, to preview the short list while the setting is off. */
  force?: boolean;
}): Promise<ScoredInvestorContact[] | null> {
  try {
    if (!args.force && !(await getBoolSetting(MATCH_PREFILTER_KEY, false))) return null;
    const ids = await candidateIdsForFounder(founderIndustries(args.industry), args.cap ?? MATCH_PREFILTER_CAP);
    if (ids.length < args.want) return null;
    const rows = await loadInvestorContacts({
      ids,
      scoreAgainst: args.scoreAgainst,
      investorsOnly: true,
      requireIndustryMatch: false,
      score: false,
    });
    return rows.length >= args.want ? rows : null;
  } catch {
    return null;
  }
}
