import { Coins, TrendingUp, Star } from "lucide-react";
import { useTranslations } from "next-intl";

const STATS = [
  { v: "$4.2M", l: "indicated · 30d", tone: "text-[var(--teal)]" },
  { v: "42", l: "active investors", tone: "text-[var(--navy)]" },
  { v: "23", l: "diligence-ready", tone: "text-[var(--navy)]" },
  { v: "76.8", l: "avg readiness", tone: "text-[var(--indigo)]" },
];

const FEED = [
  { Icon: Coins, tone: "bg-[var(--teal-muted)] text-[var(--teal)]", text: "An investor indicated $500K in an AI deal", when: "2d" },
  { Icon: TrendingUp, tone: "bg-[var(--teal-muted)] text-[var(--teal)]", text: "A healthtech deal hit 84 readiness", when: "3d" },
  { Icon: Star, tone: "bg-[var(--indigo-soft)] text-[var(--indigo)]", text: "A top-quartile investor reviewed a deal", when: "4d" },
];

/**
 * Illustrative Private Market snapshot for marketing pages. Sample figures —
 * not live platform data — clearly labeled as such.
 */
export function MarketingMarketPreview() {
  const t = useTranslations("sharedCmp");
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--teal)]">
          <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--teal)] text-[var(--teal)]" />
          The Private Market
        </span>
        <span className="font-mono text-[10px] text-slate-400">{t("illustrative_preview")}</span>
      </div>

      <div className="grid grid-cols-2 border-b border-slate-200">
        {STATS.map((s, i) => (
          <div
            key={s.l}
            className={`border-slate-200 px-5 py-4 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b" : ""}`}
          >
            <div className={`font-mono text-[21px] font-semibold leading-none ${s.tone}`}>{s.v}</div>
            <div className="mt-1.5 font-mono text-[9.5px] tracking-wide text-slate-400">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="py-2">
        {FEED.map((f) => (
          <div key={f.text} className="flex items-center gap-2.5 px-5 py-2.5 text-[12px] text-slate-600">
            <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-md ${f.tone}`}>
              <f.Icon className="h-3 w-3" strokeWidth={2} />
            </span>
            <span>{f.text}</span>
            <span className="ml-auto font-mono text-[10px] text-slate-400">{f.when}</span>
          </div>
        ))}
      </div>

      <p className="border-t border-slate-100 px-5 py-2.5 text-center font-mono text-[9.5px] text-slate-400">
        Sample activity shown for illustration — not live platform data.
      </p>
    </div>
  );
}
