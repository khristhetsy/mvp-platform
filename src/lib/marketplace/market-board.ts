/**
 * Pure builders for the signed in Private Market board (NSE style).
 *
 * Input is the full score history of non sample companies: one event per score
 * reading. Nothing here touches the database, and nothing leaves it per company
 * except the listed (opted in) companies the page already shows.
 */
import { bandKeyForScore } from "@/lib/marketplace/readiness-board";

export type ScoreEvent = { companyId: string; at: string; score: number | null };

export type Snapshot = { founders: number; avg: number | null; strong: number; moderate: number; building: number };

export type Delta = { value: number; change: number; pct: number | null };

export type Candle = {
  /** Monday of the week, YYYY-MM-DD (UTC). */
  weekStart: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Score readings recorded in the week. */
  readings: number;
};

export type CompanyChange = { first: number; latest: number; change: number; pct: number | null; firstAt: string };

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

const sorted = (events: ReadonlyArray<ScoreEvent>) =>
  events
    .filter((e) => Number.isFinite(Date.parse(e.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

function snapshotOf(latest: Map<string, number>): Snapshot {
  let sum = 0;
  let strong = 0;
  let moderate = 0;
  let building = 0;
  for (const s of latest.values()) {
    sum += s;
    const band = bandKeyForScore(s);
    if (band === "strong") strong += 1;
    else if (band === "moderate") moderate += 1;
    else building += 1;
  }
  const founders = latest.size;
  return { founders, avg: founders === 0 ? null : round2(sum / founders), strong, moderate, building };
}

/** Each company's newest score reading at or before asOf (a null reading drops the company). */
export function snapshotAsOf(events: ReadonlyArray<ScoreEvent>, asOfMs: number): Snapshot {
  const latest = new Map<string, number>();
  for (const e of sorted(events)) {
    if (Date.parse(e.at) > asOfMs) break;
    if (typeof e.score === "number" && Number.isFinite(e.score)) latest.set(e.companyId, e.score);
    else latest.delete(e.companyId);
  }
  return snapshotOf(latest);
}

export function delta(now: number, before: number | null): Delta {
  const change = before === null ? 0 : now - before;
  return {
    value: now,
    change,
    pct: before === null || before === 0 ? null : (change / before) * 100,
  };
}

export type BoardTiles = {
  avgCrr: Delta | null;
  founders: Delta;
  strong: Delta;
  moderate: Delta;
  building: Delta;
  windowDays: number;
  from: string;
  to: string;
};

/** The index tiles: now against the same board windowDays ago. */
export function boardTiles(events: ReadonlyArray<ScoreEvent>, nowMs: number, windowDays = 7): BoardTiles {
  const now = snapshotAsOf(events, nowMs);
  const then = snapshotAsOf(events, nowMs - windowDays * DAY);
  return {
    avgCrr: now.avg === null ? null : delta(round2(now.avg), then.avg === null ? null : then.avg),
    founders: delta(now.founders, then.founders),
    strong: delta(now.strong, then.strong),
    moderate: delta(now.moderate, then.moderate),
    building: delta(now.building, then.building),
    windowDays,
    from: new Date(nowMs - windowDays * DAY).toISOString(),
    to: new Date(nowMs).toISOString(),
  };
}

function mondayOf(ms: number): number {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

/**
 * Weekly OHLC candles of the platform average CRR. The average is re-taken after
 * every score reading; a week opens at the previous close. Weeks with no reading
 * are flat candles, so the time axis is continuous.
 */
export function weeklyCandles(events: ReadonlyArray<ScoreEvent>, nowMs: number): Candle[] {
  const evs = sorted(events);
  if (evs.length === 0) return [];
  const latest = new Map<string, number>();
  const candles: Candle[] = [];
  let i = 0;
  let prevClose: number | null = null;
  for (let w = mondayOf(Date.parse(evs[0].at)); w <= nowMs; w += 7 * DAY) {
    const end = w + 7 * DAY;
    let open: number | null = prevClose;
    let high = -Infinity;
    let low = Infinity;
    let close: number | null = prevClose;
    let readings = 0;
    while (i < evs.length && Date.parse(evs[i].at) < end) {
      const e = evs[i];
      if (typeof e.score === "number" && Number.isFinite(e.score)) latest.set(e.companyId, e.score);
      else latest.delete(e.companyId);
      readings += 1;
      const avg = snapshotOf(latest).avg;
      if (avg !== null) {
        if (open === null) open = avg;
        high = Math.max(high, avg);
        low = Math.min(low, avg);
        close = avg;
      }
      i += 1;
    }
    if (open === null || close === null) continue;
    high = Math.max(high, open);
    low = Math.min(low, open);
    candles.push({
      weekStart: new Date(w).toISOString().slice(0, 10),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      readings,
    });
    prevClose = close;
  }
  return candles;
}

/** Simple moving average over the close, null until n candles exist. */
export function movingAverage(candles: ReadonlyArray<Candle>, n = 3): Array<number | null> {
  return candles.map((_, idx) =>
    idx + 1 < n ? null : round2(candles.slice(idx + 1 - n, idx + 1).reduce((a, c) => a + c.close, 0) / n),
  );
}

/** First reading against the latest reading of one company; null with fewer than two readings. */
export function companyChange(events: ReadonlyArray<ScoreEvent>, companyId: string): CompanyChange | null {
  const own = sorted(events).filter((e) => e.companyId === companyId && typeof e.score === "number");
  if (own.length < 2) return null;
  const first = own[0].score as number;
  const latest = own[own.length - 1].score as number;
  return {
    first,
    latest,
    change: latest - first,
    pct: first === 0 ? null : ((latest - first) / first) * 100,
    firstAt: own[0].at,
  };
}

/** Dates (ISO strings) that fall inside the trailing window. */
export function countInWindow(dates: ReadonlyArray<string>, nowMs: number, days: number): number {
  const from = nowMs - days * DAY;
  return dates.filter((d) => {
    const t = Date.parse(d);
    return Number.isFinite(t) && t > from && t <= nowMs;
  }).length;
}

export type Direction = "up" | "down" | "flat";
export const directionOf = (change: number): Direction => (change > 0 ? "up" : change < 0 ? "down" : "flat");
export const ARROW: Record<Direction, string> = { up: "▲", down: "▼", flat: "▬" };

export function signed(n: number, digits = 0): string {
  const v = digits === 0 ? String(Math.round(Math.abs(n))) : Math.abs(n).toFixed(digits);
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${v}`;
}

export function signedPct(n: number | null): string {
  return n === null ? "n/a" : `${signed(n, 1)}%`;
}


export type SectorRow = { sector: string; avg: number; change: number | null };

/** Fewer scored companies than this and a sector tile could single a company out. */
export const SECTOR_MIN_COMPANIES = 3;

function latestAsOf(events: ReadonlyArray<ScoreEvent>, asOfMs: number): Map<string, number> {
  const latest = new Map<string, number>();
  for (const e of sorted(events)) {
    if (Date.parse(e.at) > asOfMs) break;
    if (typeof e.score === "number" && Number.isFinite(e.score)) latest.set(e.companyId, e.score);
    else latest.delete(e.companyId);
  }
  return latest;
}

function sectorAverages(latest: Map<string, number>, industryByCompany: ReadonlyMap<string, string | null>) {
  const groups = new Map<string, { label: string; scores: number[] }>();
  for (const [companyId, score] of latest) {
    const sectors = String(industryByCompany.get(companyId) ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    for (const name of sectors) {
      const g = groups.get(name.toLowerCase()) ?? { label: name, scores: [] };
      g.scores.push(score);
      groups.set(name.toLowerCase(), g);
    }
  }
  return groups;
}

/**
 * Average CRR per sector, highest first, only for sectors with at least
 * SECTOR_MIN_COMPANIES scored companies. A company with several sectors counts
 * in each. The change compares with windowDays ago and is null when the sector
 * did not yet have enough companies then.
 */
export function sectorBoard(
  events: ReadonlyArray<ScoreEvent>,
  industryByCompany: ReadonlyMap<string, string | null>,
  nowMs: number,
  windowDays = 7,
): SectorRow[] {
  const now = sectorAverages(latestAsOf(events, nowMs), industryByCompany);
  const then = sectorAverages(latestAsOf(events, nowMs - windowDays * DAY), industryByCompany);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const rows: SectorRow[] = [];
  for (const [key, g] of now) {
    if (g.scores.length < SECTOR_MIN_COMPANIES) continue;
    const before = then.get(key);
    const nowAvg = round2(avg(g.scores));
    rows.push({
      sector: g.label,
      avg: nowAvg,
      change: before && before.scores.length >= SECTOR_MIN_COMPANIES ? round2(nowAvg - avg(before.scores)) : null,
    });
  }
  return rows.sort((a, b) => b.avg - a.avg || a.sector.localeCompare(b.sector));
}
