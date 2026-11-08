"use client";

import { NseClock } from "@/components/marketing/NseClock";
import { toSymbol } from "@/lib/investor/private-market";
import type { MarketBoardData } from "@/lib/data/market-board";
import type { ListedCompany } from "@/lib/listing/private-market";
import { ARROW, directionOf, signed, signedPct, type Candle, type SectorRow, type Delta, type Direction } from "@/lib/marketplace/market-board";

const TONE: Record<Direction, string> = { up: "text-[#0f7a54]", down: "text-[#d92d20]", flat: "text-slate-500" };
const TICKER_TONE: Record<Direction, string> = { up: "text-[#4ade9b]", down: "text-[#ff8a80]", flat: "text-slate-300" };
const CARD = "rounded-2xl border border-site-line bg-white shadow-sm";
const ROWS = 5;

const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));

function Tile({ label, delta, digits = 0 }: Readonly<{ label: string; delta: Delta | null; digits?: number }>) {
  const dir = directionOf(delta?.change ?? 0);
  return (
    <div className="flex flex-col justify-center gap-1 border-r border-site-line px-5 py-4 last:border-r-0">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className={`font-[family-name:var(--font-site-archivo)] text-3xl font-extrabold leading-none tracking-tight text-[var(--navy)] sm:text-4xl`}>
        {delta === null ? "n/a" : digits ? delta.value.toFixed(digits) : delta.value}
      </span>
      {delta ? (
        <span className={`font-mono text-[13px] ${TONE[dir]}`}>
          {ARROW[dir]} {signed(delta.change, digits ? 2 : 0)} &nbsp;{signedPct(delta.pct)}
        </span>
      ) : null}
    </div>
  );
}

type BoardRow = { key: string; id: string; symbol: string; crr: number | null; change: number | null; pct: number | null };

function RowsPanel({ title, rows, onOpen }: Readonly<{ title: string; rows: BoardRow[]; onOpen: (id: string) => void }>) {
  const fill = Math.max(0, ROWS - rows.length);
  return (
    <div className={`${CARD} px-5 py-5`}>
      <h3 className="mb-1 font-[family-name:var(--font-site-archivo)] text-xl font-bold tracking-tight text-[var(--navy)]">{title}</h3>
      <div className="grid grid-cols-[1.35fr_0.8fr_0.8fr_1fr] gap-1.5 mt-3 border-b border-site-line pb-2 font-mono text-[10.5px] tracking-[0.12em] text-slate-500">
        <span>SYMBOL</span>
        <span className="text-right">CRR</span>
        <span className="text-right">CHG</span>
        <span className="text-right">%CHG</span>
      </div>
      {rows.map((r) => {
        const dir = directionOf(r.change ?? 0);
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onOpen(r.id)}
            aria-label={`Open one pager for ${r.symbol}`}
            className={`-mx-1.5 grid h-[54px] w-[calc(100%+0.75rem)] grid-cols-[1.35fr_0.8fr_0.8fr_1fr] items-center gap-1.5 rounded-lg px-1.5 text-left font-[family-name:var(--font-site-archivo)] text-[17px] font-semibold transition-colors hover:bg-[var(--blue-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)] ${TONE[dir]}`}
          >
            <span className="whitespace-nowrap text-[19px] font-bold">
              <i className="mr-1.5 text-sm not-italic">{ARROW[dir]}</i>
              {r.symbol}
            </span>
            <span className="text-right">{r.crr === null ? "n/a" : Math.round(r.crr)}</span>
            <span className="text-right">{r.change === null ? "n/a" : signed(r.change)}</span>
            <span className="text-right">{signedPct(r.pct)}</span>
          </button>
        );
      })}
      {Array.from({ length: fill }, (_, i) => (
        <div key={`f${i}`} aria-hidden className="grid h-[54px] grid-cols-[1.35fr_0.8fr_0.8fr_1fr] items-center gap-1.5 font-[family-name:var(--font-site-archivo)] text-lg text-slate-300">
          <span>—</span>
          <span className="text-right">—</span>
          <span className="text-right">—</span>
          <span className="text-right">—</span>
        </div>
      ))}
    </div>
  );
}

function SectorPanel({ sectors, active, onPick, windowDays }: Readonly<{ sectors: SectorRow[]; active: string | null; onPick: (sector: string) => void; windowDays: number }>) {
  return (
    <div className={`${CARD} px-5 py-5`}>
      <h3 className="mb-1 font-[family-name:var(--font-site-archivo)] text-xl font-bold tracking-tight text-[var(--navy)]">Sector board</h3>
      <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr] gap-1.5 mt-3 border-b border-site-line pb-2 font-mono text-[10.5px] tracking-[0.12em] text-slate-500">
        <span>SECTOR</span>
        <span className="text-right">CRR</span>
        <span className="text-right">CHG</span>
      </div>
      {sectors.length === 0 ? (
        <p className="pt-3 font-mono text-[11px] leading-relaxed text-slate-500">
          No approved companies yet.
        </p>
      ) : (
        <div className="cap-vmarquee-host h-[300px] overflow-hidden pr-1.5">
        <div className={sectors.length > 6 ? "cap-vmarquee" : ""}>
        {(sectors.length > 6 ? [0, 1] : [0]).map((copy) => (
        <div key={copy} aria-hidden={copy === 1}>
        {sectors.map((r) => {
          const dir = directionOf(r.change ?? 0);
          return (
            <button
              key={r.sector}
              type="button"
              tabIndex={copy === 1 ? -1 : undefined}
              onClick={() => onPick(r.sector)}
              aria-pressed={active?.toLowerCase() === r.sector.toLowerCase()}
              title={`Show only ${r.sector} companies (${r.scored} scored of ${r.companies})`}
              className={`-mx-1.5 grid h-[42px] w-[calc(100%+0.75rem)] grid-cols-[1.9fr_0.6fr_0.6fr] items-center gap-1.5 rounded-lg px-1.5 text-left font-[family-name:var(--font-site-archivo)] text-base font-semibold transition-colors hover:bg-[var(--blue-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)] ${active?.toLowerCase() === r.sector.toLowerCase() ? "bg-[var(--blue-muted)] outline outline-2 outline-[var(--blue)]" : ""} ${TONE[dir]}`}
            >
              <span className="truncate uppercase">
                <i className="mr-1.5 text-sm not-italic">{ARROW[dir]}</i>
                {r.sector}
              </span>
              <span className="text-right">{r.avg === null ? "n/a" : r.avg.toFixed(1)}</span>
              <span className="text-right">{r.change === null ? "n/a" : signed(r.change, 1)}</span>
            </button>
          );
        })}
        </div>
        ))}
        </div>
        </div>
      )}
      <p className="pt-2 font-mono text-[10px] tracking-[0.06em] text-slate-500">ALL SECTORS OF APPROVED COMPANIES. CHG IS N/A UNTIL EVERY SCORED COMPANY HAS A READING FROM {windowDays} DAYS AGO.</p>
    </div>
  );
}

function CandleChart({ candles, ma }: Readonly<{ candles: Candle[]; ma: Array<number | null> }>) {
  if (candles.length === 0) return <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">No readings yet</div>;
  const W = 640;
  const L = 46;
  const R = 628;
  const lo = Math.floor(Math.min(...candles.map((c) => c.low)) - 2);
  const hi = Math.ceil(Math.max(...candles.map((c) => c.high)) + 2);
  const y = (v: number) => 20 + (1 - (v - lo) / (hi - lo || 1)) * 160;
  const step = (R - L) / candles.length;
  const x = (i: number) => L + step * i + step / 2;
  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
  const maPoints = ma.flatMap((v, i) => (v === null ? [] : [`${x(i).toFixed(1)},${y(v).toFixed(1)}`])).join(" ");
  return (
    <svg viewBox={`0 0 ${W} 268`} width="100%" role="img" aria-label="Weekly candles of the average CRR of scored founders">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={R} y1={y(t)} y2={y(t)} stroke="#dbe4f3" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#0f1b3d">{t.toFixed(0)}</text>
        </g>
      ))}
      {candles.map((c, i) => {
        const up = c.close > c.open;
        const down = c.close < c.open;
        const color = up ? "#0f9d6b" : down ? "#d92d20" : "#4a5878";
        const top = y(Math.max(c.open, c.close));
        const h = Math.max(1.5, Math.abs(y(c.open) - y(c.close)));
        return (
          <g key={c.weekStart}>
            <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1.5" />
            <rect x={x(i) - step * 0.28} y={top} width={step * 0.56} height={h} fill={color} />
          </g>
        );
      })}
      {maPoints ? <polyline points={maPoints} fill="none" stroke="#1d4ed8" strokeWidth="2" /> : null}
      {candles.map((c, i) =>
        i === 0 || c.weekStart.slice(0, 7) !== candles[i - 1].weekStart.slice(0, 7) ? (
          <text key={`m${c.weekStart}`} x={x(i)} y={264} textAnchor="middle" fontSize="12" fill="#0f1b3d">
            {new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(c.weekStart)).toUpperCase()}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function tickerItems(data: MarketBoardData, outreach: Delta): Array<{ label: string; value: string; delta: Delta | null; digits?: number }> {
  const t = data.tiles;
  return [
    { label: "AVG CRR", value: t.avgCrr ? t.avgCrr.value.toFixed(1) : "n/a", delta: t.avgCrr, digits: 2 },
    { label: "FOUNDERS", value: String(t.founders.value), delta: t.founders },
    { label: "STRONG", value: String(t.strong.value), delta: t.strong },
    { label: "OUTREACH", value: String(outreach.value), delta: outreach },
    { label: "MODERATE", value: String(t.moderate.value), delta: t.moderate },
    { label: "BUILDING", value: String(t.building.value), delta: t.building },
  ];
}

/**
 * The signed in Private Market board, NSE style: index tiles, top gainers, the
 * weekly candle chart of the platform average CRR, top new company and a ticker.
 * Every number is real; the gainers are approved companies.
 */
export function NseBoard({
  data,
  companies,
  activeSector,
  onSector,
  onOpenCompany,
}: Readonly<{
  data: MarketBoardData;
  companies: ListedCompany[];
  activeSector: string | null;
  onSector: (sector: string) => void;
  onOpenCompany: (id: string) => void;
}>) {
  const t = data.tiles;
  const outreachPrev = data.outreach.total - data.outreach.change;
  const outreachDelta: Delta = {
    value: data.outreach.total,
    change: data.outreach.change,
    pct: outreachPrev > 0 ? (data.outreach.change / outreachPrev) * 100 : null,
  };

  const asRow = (c: ListedCompany): BoardRow => {
    const ch = data.byCompany[c.id]?.crr ?? null;
    return { key: c.id, id: c.id, symbol: toSymbol(c.name), crr: c.crr, change: ch?.change ?? null, pct: ch?.pct ?? null };
  };
  const gainers = companies
    .filter((c) => (data.byCompany[c.id]?.crr?.change ?? 0) > 0)
    .sort((a, b) => (data.byCompany[b.id]?.crr?.change ?? 0) - (data.byCompany[a.id]?.crr?.change ?? 0))
    .slice(0, ROWS)
    .map(asRow);

  const items = tickerItems(data, outreachDelta);
  const gainerItems = gainers.map((g) => ({
    label: g.symbol,
    value: g.crr === null ? "n/a" : String(Math.round(g.crr)),
    delta: g.change === null ? null : ({ value: g.crr ?? 0, change: g.change, pct: g.pct } satisfies Delta),
    digits: 0,
  }));
  const loop = [...gainerItems, ...items];

  return (
    <section aria-label="Private Market board" className="space-y-5">
      <div>
        <div className="space-y-5">
          <div className={`${CARD} grid grid-cols-2 items-stretch overflow-hidden shadow-[0_8px_24px_rgba(12,35,64,0.08)] lg:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_100px]`}>
            <Tile label="AVG CRR" delta={t.avgCrr} digits={2} />
            <Tile label="FOUNDERS SCORED" delta={t.founders} />
            <Tile label="STRONG BAND" delta={t.strong} />
            <Tile label="OUTREACH" delta={outreachDelta} />
            <div className="col-span-2 border-r border-site-line px-5 py-4 lg:col-span-1">
              <NseClock />
            </div>
            <svg className="m-auto hidden lg:block" width="76" height="64" viewBox="0 0 96 76" aria-hidden="true">
              {[22, 32, 44, 58].map((h, i) => (
                <rect key={h} x={4 + i * 20} y={74 - h} width="14" height={h} fill="#0f9d6b" />
              ))}
            </svg>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-[1fr_1.45fr_0.95fr]">
            <RowsPanel title="Top Gainers" rows={gainers} onOpen={onOpenCompany} />
            <div className={`${CARD} bg-gradient-to-b from-[#f3f7ff] to-white px-3 pb-2 pt-4 md:order-3 md:col-span-2 lg:order-none lg:col-span-1`}>
              <CandleChart candles={data.candles} ma={data.movingAverage} />
            </div>
            <SectorPanel sectors={data.sectors} active={activeSector} onPick={onSector} windowDays={t.windowDays} />
          </div>

          <div className="cap-marquee-host overflow-hidden whitespace-nowrap rounded-2xl bg-[var(--navy)]" aria-label="Board ticker">
            <div className="cap-marquee inline-flex">
              {[0, 1].map((copy) => (
                <div key={copy} className="inline-flex" aria-hidden={copy === 1}>
                  {loop.map((it) => {
                    const dir = directionOf(it.delta?.change ?? 0);
                    return (
                      <span key={`${copy}${it.label}`} className="inline-flex min-w-[200px] flex-col border-r border-white/10 px-8 py-3">
                        <span className="flex items-baseline gap-3 font-[family-name:var(--font-site-archivo)] text-2xl font-bold text-white">
                          {it.label} <em className={`not-italic ${TICKER_TONE[dir]}`}>{it.value}</em>
                          {it.delta ? <u className={`text-xl no-underline ${TICKER_TONE[dir]}`}>{ARROW[dir]}</u> : null}
                        </span>
                        {it.delta ? (
                          <span className={`font-mono text-[13px] ${TICKER_TONE[dir]}`}>
                            {signed(it.delta.change, it.digits ?? 0)} ({signedPct(it.delta.pct)})
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="px-1 pt-1 font-mono text-[11px] leading-relaxed text-slate-600">
        Index tiles and the ticker show the change over the last {t.windowDays} days ({dayMonth(t.from)} to {dayMonth(t.to)}) across all scored
        founders and all investor outreach on the platform. Top Gainers ranks approved companies by CRR change since their first reading. The Sector board
        averages CRR across all scored companies in a sector, listed for every sector of the approved companies, with the change over the same {t.windowDays} days. Candles are the weekly open, high, low and close of the average CRR of scored founders (the
        number of founders grows over time), and the blue line is a 3 week moving average.
      </p>
    </section>
  );
}
