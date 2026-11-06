import { IcapOSLogo } from "@/components/IcapOSLogo";
import { NseClock } from "@/components/marketing/NseClock";
import { toSymbol } from "@/lib/investor/private-market";
import type { MarketBoardData } from "@/lib/data/market-board";
import type { ListedCompany } from "@/lib/listing/private-market";
import { ARROW, SECTOR_MIN_COMPANIES, directionOf, signed, signedPct, type Candle, type SectorRow, type Delta, type Direction } from "@/lib/marketplace/market-board";

const TONE: Record<Direction, string> = { up: "text-[#0f7a54]", down: "text-[#d92d20]", flat: "text-slate-500" };
const ROWS = 5;

const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));

function Tile({ label, delta, digits = 0 }: Readonly<{ label: string; delta: Delta | null; digits?: number }>) {
  const dir = directionOf(delta?.change ?? 0);
  return (
    <div className="flex flex-col justify-center gap-0.5 border-r border-slate-200 px-5 py-3">
      <span className="font-[family-name:var(--font-site-archivo)] text-[15px] tracking-wide text-[var(--navy)]">{label}</span>
      <span className={`font-[family-name:var(--font-site-archivo)] text-4xl font-semibold leading-none ${TONE[dir]}`}>
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

type BoardRow = { key: string; symbol: string; crr: number | null; change: number | null; pct: number | null };

function RowsPanel({ title, rows }: Readonly<{ title: string; rows: BoardRow[] }>) {
  const fill = Math.max(0, ROWS - rows.length);
  return (
    <div className="px-4 py-4">
      <h3 className="mb-2 font-[family-name:var(--font-site-archivo)] text-2xl font-medium text-[var(--navy)]">{title}</h3>
      <div className="grid grid-cols-[1.35fr_0.8fr_0.8fr_1fr] gap-1.5 border-b-2 border-[var(--navy)] pb-1.5 font-mono text-[11px] text-[var(--navy)]">
        <span>SYMBOL</span>
        <span className="text-right">CRR</span>
        <span className="text-right">CHG</span>
        <span className="text-right">%CHG</span>
      </div>
      {rows.map((r) => {
        const dir = directionOf(r.change ?? 0);
        return (
          <div key={r.key} className={`grid h-11 grid-cols-[1.35fr_0.8fr_0.8fr_1fr] items-center gap-1.5 font-[family-name:var(--font-site-archivo)] text-xl font-medium ${TONE[dir]}`}>
            <span>
              <i className="mr-1.5 text-sm not-italic">{ARROW[dir]}</i>
              {r.symbol}
            </span>
            <span className="text-right">{r.crr === null ? "n/a" : Math.round(r.crr)}</span>
            <span className="text-right">{r.change === null ? "n/a" : signed(r.change)}</span>
            <span className="text-right">{signedPct(r.pct)}</span>
          </div>
        );
      })}
      {Array.from({ length: fill }, (_, i) => (
        <div key={`f${i}`} aria-hidden className="grid h-11 grid-cols-[1.35fr_0.8fr_0.8fr_1fr] items-center gap-1.5 font-[family-name:var(--font-site-archivo)] text-lg text-slate-300">
          <span>—</span>
          <span className="text-right">—</span>
          <span className="text-right">—</span>
          <span className="text-right">—</span>
        </div>
      ))}
    </div>
  );
}

function SectorPanel({ sectors }: Readonly<{ sectors: SectorRow[] }>) {
  return (
    <div className="px-4 py-4">
      <h3 className="mb-2 font-[family-name:var(--font-site-archivo)] text-2xl font-medium text-[var(--navy)]">Sector board</h3>
      <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr] gap-1.5 border-b-2 border-[var(--navy)] pb-1.5 font-mono text-[11px] text-[var(--navy)]">
        <span>SECTOR</span>
        <span className="text-right">CRR</span>
        <span className="text-right">CHG</span>
      </div>
      {sectors.length === 0 ? (
        <p className="pt-3 font-mono text-[11px] leading-relaxed text-slate-500">
          A sector appears once {SECTOR_MIN_COMPANIES} or more scored companies share it, so no single company can be picked out.
        </p>
      ) : (
        sectors.slice(0, 8).map((r) => {
          const dir = directionOf(r.change ?? 0);
          return (
            <div key={r.sector} className={`grid h-8 grid-cols-[1.6fr_0.8fr_0.8fr] items-center gap-1.5 font-[family-name:var(--font-site-archivo)] text-lg font-medium ${TONE[dir]}`}>
              <span className="truncate uppercase">
                <i className="mr-1.5 text-sm not-italic">{ARROW[dir]}</i>
                {r.sector}
              </span>
              <span className="text-right">{r.avg.toFixed(1)}</span>
              <span className="text-right">{r.change === null ? "n/a" : signed(r.change, 1)}</span>
            </div>
          );
        })
      )}
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
  const maxReadings = Math.max(1, ...candles.map((c) => c.readings));
  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
  const maPoints = ma.flatMap((v, i) => (v === null ? [] : [`${x(i).toFixed(1)},${y(v).toFixed(1)}`])).join(" ");
  return (
    <svg viewBox={`0 0 ${W} 268`} width="100%" role="img" aria-label="Weekly candles of the average CRR of scored founders, with score readings per week as bars">
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
        const bar = (c.readings / maxReadings) * 52;
        return (
          <g key={c.weekStart}>
            <rect x={x(i) - step * 0.3} y={250 - bar} width={step * 0.6} height={bar} fill="#93b4f0" />
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
 * Every number is real; gainers and new companies are listed (opted in) companies only.
 */
export function NseBoard({ data, companies }: Readonly<{ data: MarketBoardData; companies: ListedCompany[] }>) {
  const t = data.tiles;
  const outreachPrev = data.outreach.total - data.outreach.change;
  const outreachDelta: Delta = {
    value: data.outreach.total,
    change: data.outreach.change,
    pct: outreachPrev > 0 ? (data.outreach.change / outreachPrev) * 100 : null,
  };

  const asRow = (c: ListedCompany): BoardRow => {
    const ch = data.byCompany[c.id]?.crr ?? null;
    return { key: c.id, symbol: toSymbol(c.name), crr: c.crr, change: ch?.change ?? null, pct: ch?.pct ?? null };
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
    <section aria-label="Private Market board" className="overflow-hidden rounded-md border-[6px] border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className="grid grid-cols-[1.1fr_1fr_1.1fr_1fr_1fr_1fr_100px] items-stretch border-b-2 border-[var(--blue)]">
            <div className="flex items-center border-r border-slate-200 px-5 py-3">
              <IcapOSLogo height={40} priority />
            </div>
            <Tile label="AVG CRR" delta={t.avgCrr} digits={2} />
            <Tile label="FOUNDERS SCORED" delta={t.founders} />
            <Tile label="STRONG BAND" delta={t.strong} />
            <Tile label="OUTREACH" delta={outreachDelta} />
            <div className="border-r border-slate-200 px-5 py-3">
              <NseClock />
            </div>
            <svg className="m-auto" width="76" height="64" viewBox="0 0 96 76" aria-hidden="true">
              {[22, 32, 44, 58].map((h, i) => (
                <rect key={h} x={4 + i * 20} y={74 - h} width="14" height={h} fill="#0f9d6b" />
              ))}
            </svg>
          </div>

          <div className="grid grid-cols-[1fr_1.45fr_0.95fr] border-b-2 border-[var(--blue)]">
            <RowsPanel title="Top Gainers" rows={gainers} />
            <div className="border-x border-slate-200 bg-[#f3f7ff] px-2.5 pb-1 pt-3">
              <CandleChart candles={data.candles} ma={data.movingAverage} />
            </div>
            <SectorPanel sectors={data.sectors} />
          </div>

          <div className="cap-marquee-host overflow-hidden whitespace-nowrap" aria-label="Board ticker">
            <div className="cap-marquee inline-flex">
              {[0, 1].map((copy) => (
                <div key={copy} className="inline-flex" aria-hidden={copy === 1}>
                  {loop.map((it) => {
                    const dir = directionOf(it.delta?.change ?? 0);
                    return (
                      <span key={`${copy}${it.label}`} className="inline-flex min-w-[200px] flex-col border-r-2 border-[var(--blue)] px-8 py-2.5">
                        <span className="flex items-baseline gap-3 font-[family-name:var(--font-site-archivo)] text-3xl text-[var(--navy)]">
                          {it.label} <em className={`not-italic ${TONE[dir]}`}>{it.value}</em>
                          {it.delta ? <u className={`text-xl no-underline ${TONE[dir]}`}>{ARROW[dir]}</u> : null}
                        </span>
                        {it.delta ? (
                          <span className={`font-mono text-[13px] ${TONE[dir]}`}>
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
      <p className="border-t border-slate-200 px-5 py-3 font-mono text-[11px] leading-relaxed text-slate-600">
        Index tiles and the ticker show the change over the last {t.windowDays} days ({dayMonth(t.from)} to {dayMonth(t.to)}) across all scored
        founders and all investor outreach on the platform. Top Gainers shows listed companies only, with the CRR change since a company&apos;s first reading. The Sector board
        averages CRR across all scored companies in a sector, shown once {SECTOR_MIN_COMPANIES} or more share it, with the change over the same {t.windowDays} days. Candles are the weekly open, high, low and close of the average CRR of scored founders (the
        number of founders grows over time), the blue line is a 3 week moving average and the blue bars count score readings per week.
      </p>
    </section>
  );
}
