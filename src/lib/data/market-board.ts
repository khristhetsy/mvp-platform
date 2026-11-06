import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  boardTiles,
  companyChange,
  countInWindow,
  movingAverage,
  sectorBoard,
  type SectorRow,
  weeklyCandles,
  type BoardTiles,
  type Candle,
  type CompanyChange,
  type ScoreEvent,
} from "@/lib/marketplace/market-board";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

const PAGE = 1000;
const TILE_WINDOW_DAYS = 7;
export const OUTREACH_COMPANY_WINDOW_DAYS = 30;

export type MarketBoardData = {
  asOf: string;
  tiles: BoardTiles;
  candles: Candle[];
  /** 3 week moving average of the candle closes, aligned with candles. */
  movingAverage: Array<number | null>;
  /** Average CRR per sector with 3 or more scored companies; empty until a sector qualifies. */
  sectors: SectorRow[];
  /** Investor outreach messages sent, platform wide: all time and the last 7 days. Counts only. */
  outreach: { total: number; change: number; windowDays: number };
  /** Per listed company only. */
  byCompany: Record<string, { crr: CompanyChange | null; outreachTotal: number; outreachChange: number }>;
};

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * Real aggregates for the signed in Private Market board: platform wide counts,
 * the weekly average CRR candles, and per listed company CRR and outreach change.
 * Sample companies are excluded. Investor identities are never read: outreach is
 * counted from send dates only. Returns null on any failure so the page can hide
 * the board instead of showing a made up number.
 */
export async function getMarketBoard(listedCompanyIds: string[], db: Db = createServiceRoleClient()): Promise<MarketBoardData | null> {
  try {
    const nowMs = Date.now();

    const scoreRows = await pageAll<{
      company_id: string;
      created_at: string;
      total_score: number | null;
      effective_score: number | null;
    }>((from, to) =>
      db
        .from("company_readiness_scores")
        .select("company_id, created_at, total_score, effective_score, companies!inner(is_sample)")
        .eq("companies.is_sample", false)
        .order("created_at", { ascending: true })
        .order("company_id", { ascending: true })
        .range(from, to),
    );
    const events: ScoreEvent[] = scoreRows.map((r) => ({
      companyId: r.company_id,
      at: r.created_at,
      score: r.effective_score ?? r.total_score,
    }));

    const companyRows = await pageAll<{ id: string; industry: string | null }>((from, to) =>
      db.from("companies").select("id, industry").eq("is_sample", false).order("id", { ascending: true }).range(from, to),
    );
    const industryByCompany = new Map(companyRows.map((r) => [r.id, r.industry]));

    const recipients = await pageAll<{ campaign_id: string; sent_at: string | null; created_at: string }>((from, to) =>
      db
        .from("investor_outreach_recipients")
        .select("campaign_id, sent_at, created_at")
        .eq("status", "sent")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    const sentAt = (r: { sent_at: string | null; created_at: string }) => r.sent_at ?? r.created_at;

    const campaignCompany = new Map<string, string>();
    if (listedCompanyIds.length > 0) {
      const { data: campaigns, error } = await db
        .from("investor_outreach_campaigns")
        .select("id, company_id")
        .in("company_id", listedCompanyIds);
      if (error) throw new Error(error.message);
      for (const c of (campaigns ?? []) as Array<{ id: string; company_id: string }>) campaignCompany.set(c.id, c.company_id);
    }

    const datesByCompany = new Map<string, string[]>();
    for (const r of recipients) {
      const companyId = campaignCompany.get(r.campaign_id);
      if (!companyId) continue;
      const list = datesByCompany.get(companyId) ?? [];
      list.push(sentAt(r));
      datesByCompany.set(companyId, list);
    }

    const byCompany: MarketBoardData["byCompany"] = {};
    for (const id of listedCompanyIds) {
      const dates = datesByCompany.get(id) ?? [];
      byCompany[id] = {
        crr: companyChange(events, id),
        outreachTotal: dates.length,
        outreachChange: countInWindow(dates, nowMs, OUTREACH_COMPANY_WINDOW_DAYS),
      };
    }

    const candles = weeklyCandles(events, nowMs);
    return {
      asOf: new Date(nowMs).toISOString(),
      tiles: boardTiles(events, nowMs, TILE_WINDOW_DAYS),
      candles,
      movingAverage: movingAverage(candles, 3),
      sectors: sectorBoard(events, industryByCompany, nowMs, TILE_WINDOW_DAYS),
      outreach: {
        total: recipients.length,
        change: countInWindow(recipients.map(sentAt), nowMs, TILE_WINDOW_DAYS),
        windowDays: TILE_WINDOW_DAYS,
      },
      byCompany,
    };
  } catch (err) {
    console.error("[market-board] load failed", err);
    return null;
  }
}
