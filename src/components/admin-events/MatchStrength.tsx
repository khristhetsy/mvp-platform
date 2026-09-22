import type { ScoreBand } from "@/lib/icfo-events/pair-types";

/**
 * How the matches are spread.
 *
 * "2,217 matches found" hides the shape of them. This is the argument for the
 * per-investor cap: at most events the pile sits at the bottom, and
 * introducing from there is how a good list becomes spam.
 */
export function MatchStrength({ bands, median, total }: Readonly<{
  bands: ScoreBand[];
  median: number | null;
  total: number;
}>) {
  if (!bands.length) return null;

  const max = Math.max(...bands.map((b) => b.count), 1);
  const weakest = bands[bands.length - 1];
  const share = total ? Math.round((weakest.count / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-3.5">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] text-[var(--navy)]">Match strength</span>
        <span className="text-[11px] text-[var(--text-muted)]">
          {median === null ? "" : `median ${median}`}
        </span>
      </div>

      <table className="w-full table-fixed text-[11.5px]">
        <tbody>
          {bands.map((b) => (
            <tr key={b.score}>
              <td className="w-28 py-1 text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--navy)]">{b.score}</span> · {b.label}
              </td>
              <td className="py-1">
                <span className="block h-2 rounded-full"
                  style={{
                    width: `${Math.max((b.count / max) * 100, 1)}%`,
                    background: b.score >= 10 ? "#1D9E75" : b.score >= 6 ? "#9FE1CB" : "#B5D4F4",
                  }} />
              </td>
              <td className="w-16 py-1 text-right tabular-nums text-[var(--navy)]">
                {b.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2.5 border-t border-[var(--border-subtle)] pt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
        Two points per shared sector, three more when the two sides are different roles.
        {share >= 25 ? (
          <>
            {" "}
            <span className="text-amber-700">
              {weakest.count.toLocaleString()} of your matches ({share}%) score {weakest.score}
            </span>
            {" "}— introducing from the bottom of that band is how a good list turns into spam.
          </>
        ) : null}
      </p>
    </div>
  );
}
