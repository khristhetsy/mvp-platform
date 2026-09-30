/**
 * The public match page and the tracked links in the Match email. Opened by a signed
 * token, no login. Investor names and contact info stay hidden here.
 */
import "server-only";
import { marketingDb } from "@/lib/marketing/db";
import { getContactInvestorRating } from "@/lib/investor-rating/contact-rating";
import { readMatchConfig, networkLabel } from "./core";
import { networkTotal } from "./service";
import { verifyMatchToken } from "./token";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
const db = (): Db => marketingDb();

export type PublicMatch = {
  contactId: string;
  company: string;
  summary: string;
  fit: number;
  sectors: string[];
  types: string[];
  stage: string | null;
  checkSize: string | null;
  revenue: string | null;
  score: number | null;
  tier: string | null;
};

export type PublicMatchPage = {
  founderRowId: string;
  company: string;
  industry: string | null;
  stage: string | null;
  matchCount: number;
  network: string;
  matches: PublicMatch[];
  callUrl: string;
  introUrl: string;
};

export async function loadPublicMatchPage(token: string): Promise<PublicMatchPage | null> {
  const id = verifyMatchToken(token);
  if (!id) return null;
  const { data: row } = await db()
    .from("match_campaign_founders")
    .select("id, campaign_id, company, industry, funding_stage, match_count, opened_page_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;
  const r = row as { id: string; campaign_id: string; company: string | null; industry: string | null; funding_stage: string | null; match_count: number; opened_page_at: string | null };
  if (!r.opened_page_at) {
    await db().from("match_campaign_founders").update({ opened_page_at: new Date().toISOString() }).eq("id", r.id);
  }

  const { data: ms } = await db()
    .from("match_campaign_matches")
    .select("investor_contact_id, match_score, investor_type, sectors, stages, check_band, reasons, investor:crm_contacts!match_campaign_matches_investor_contact_id_fkey(source, contact_type, email, raw)")
    .eq("campaign_founder_id", r.id)
    .eq("removed", false)
    .order("match_score", { ascending: false });
  const list = (ms ?? []) as Array<{ investor_contact_id: string; match_score: number; investor_type: string | null; sectors: string[]; stages: string[]; check_band: string | null; reasons: string[]; investor: { source: string | null; contact_type: string | null; email: string | null; raw: { __profile?: { membership?: string } } | null } | null }>;

  const matches: PublicMatch[] = await Promise.all(list.map(async (m, i) => {
    const rating = m.investor
      ? await getContactInvestorRating({
          source: m.investor.source, contact_type: m.investor.contact_type ?? "investor", email: m.investor.email,
          membership: m.investor.raw?.__profile?.membership ?? null,
        }).catch(() => null)
      : null;
    return {
      // Names are masked before payment; the numbered label keeps rows distinguishable.
      contactId: `m${i + 1}`,
      company: `Investor match ${i + 1} · name hidden`,
      summary: m.reasons?.[0] ?? "",
      fit: m.match_score,
      sectors: m.sectors ?? [],
      types: m.investor_type ? [m.investor_type] : [],
      stage: (m.stages ?? []).join(", ") || null,
      checkSize: m.check_band,
      revenue: null,
      score: rating?.score ?? null,
      tier: rating?.tier ?? null,
    };
  }));

  return {
    founderRowId: r.id,
    company: r.company || "Your company",
    industry: r.industry,
    stage: r.funding_stage,
    matchCount: r.match_count,
    network: networkLabel(await networkTotal()),
    matches,
    callUrl: `/mc/${token}?a=call`,
    introUrl: `/mc/${token}?a=intro`,
  };
}

/** Record a tracked click and return where to send the founder. */
export async function recordMatchClick(token: string, action: string): Promise<string> {
  const id = verifyMatchToken(token);
  if (!id) return "/";
  const { data: row } = await db().from("match_campaign_founders").select("id, campaign_id, clicked_call_at, clicked_intro_at").eq("id", id).maybeSingle();
  if (!row) return "/";
  const r = row as { id: string; campaign_id: string; clicked_call_at: string | null; clicked_intro_at: string | null };
  const now = new Date().toISOString();
  if (action === "call") {
    if (!r.clicked_call_at) await db().from("match_campaign_founders").update({ clicked_call_at: now }).eq("id", r.id);
    const { data: c } = await db().from("marketing_campaigns").select("match_config").eq("id", r.campaign_id).maybeSingle();
    return readMatchConfig((c as { match_config?: unknown } | null)?.match_config).schedule_url;
  }
  if (action === "intro") {
    if (!r.clicked_intro_at) await db().from("match_campaign_founders").update({ clicked_intro_at: now }).eq("id", r.id);
    return "/start?from=match";
  }
  return `/matches/${token}`;
}
