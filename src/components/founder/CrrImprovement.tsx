import Link from "next/link";
import type { ImprovementStep } from "@/lib/crr/improvement";

export type CrrDimensionBar = {
  label: string;
  /** Points this dimension currently supplies, and could supply. */
  contributes: number;
  weight: number;
};

export type CrrImprovementProps = {
  companyName: string;
  score: number | null;
  band: string | null;
  gate: number;
  pointsToGate: number;
  outreachUnlocked: boolean;
  dimensions: CrrDimensionBar[];
  steps: ImprovementStep[];
  reach: { enough: boolean; available: number; shortfall: number };
  scoredAt: string | null;
  /** Stated here because they feed the score rather than scoring separately. */
  inputs?: { documents: string; diligence: string } | null;
};

const CARD = "rounded-xl border border-[var(--border-subtle)] bg-white p-5";
const LABEL = "text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]";

const RING = 2 * Math.PI * 50;

function Ring({ score, gate, unlocked }: Readonly<{ score: number; gate: number; unlocked: boolean }>) {
  // The gate as a tick on the arc, so the score reads as a distance rather than
  // a bare number.
  const angle = (gate / 100) * 360 - 90;
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28" role="img" aria-label={`CRR ${score} of 100, gate at ${gate}`}>
      <circle cx="60" cy="60" r="50" fill="none" strokeWidth="9" style={{ stroke: "var(--border-subtle)" }} />
      <circle
        cx="60" cy="60" r="50" fill="none" strokeWidth="9" strokeLinecap="round"
        stroke={unlocked ? "#1D9E75" : "#EF9F27"}
        strokeDasharray={`${(Math.min(100, Math.max(0, score)) / 100) * RING} ${RING}`}
        transform="rotate(-90 60 60)"
      />
      <line
        x1="60" y1="5" x2="60" y2="20" strokeWidth="3" style={{ stroke: "var(--navy)" }}
        transform={`rotate(${angle + 90} 60 60)`}
      />
      <text x="60" y="58" textAnchor="middle" style={{ fontSize: 30, fontWeight: 600, fill: "var(--navy)" }}>
        {score}
      </text>
      <text x="60" y="77" textAnchor="middle" style={{ fontSize: 11, fill: "var(--text-secondary)" }}>
        of 100
      </text>
    </svg>
  );
}

/**
 * The rating, where its points are, and what to do about it.
 *
 * Server-rendered: nothing here simulates a score. The old wizard added
 * hard-coded points in the browser and told the founder to reload; this shows
 * what each step is worth and lets the re-score be the thing that moves it.
 */
export function CrrImprovement({
  companyName, score, band, gate, pointsToGate, outreachUnlocked,
  dimensions, steps, reach, scoredAt, inputs,
}: Readonly<CrrImprovementProps>) {
  if (score === null) {
    return (
      <div className={CARD}>
        <h2 className="text-base font-semibold text-[var(--navy)]">Not scored yet</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {companyName} has no Capital Readiness Rating yet. Upload your core documents and run the rating — a
          score of 0 would be a claim nobody has earned.
        </p>
        <Link href="/founder/readiness/data-room"
          className="mt-4 inline-block rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white">
          Open your data room →
        </Link>
      </div>
    );
  }

  const maxWeight = Math.max(...dimensions.map((d) => d.weight), 1);

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <div className="flex flex-wrap items-center gap-5">
          <Ring score={score} gate={gate} unlocked={outreachUnlocked} />

          <div className="min-w-[210px] flex-1">
            <p className={LABEL}>Capital Readiness Rating</p>
            <p className="mt-1 text-lg font-semibold text-[var(--navy)]">
              {outreachUnlocked
                ? "Outreach is open"
                : `${pointsToGate} point${pointsToGate === 1 ? "" : "s"} to the gate`}
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
              {band ? `${band} band. ` : ""}
              {outreachUnlocked
                ? "Introductions and automated outreach are available."
                : `Introductions and automated outreach unlock at ${gate}.`}
            </p>
            {inputs ? (
              <p className="mt-1.5 text-[12px] text-[var(--text-secondary)]">
                {inputs.documents} · {inputs.diligence}
              </p>
            ) : null}
            {scoredAt ? (
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                Scored {new Date(scoredAt).toLocaleDateString()} from your documents and profile. These feed the
                score rather than being counted again beside it.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <p className={LABEL}>Where your points are, at your stage</p>
          <table className="mt-2 w-full table-fixed text-xs">
            <tbody>
              {dimensions.map((d) => (
                <tr key={d.label}>
                  <td className="w-24 py-1 text-[var(--text-secondary)]">{d.label}</td>
                  <td className="py-1">
                    <span className="block h-2 rounded-full bg-slate-100">
                      <span
                        className="block h-2 rounded-full"
                        style={{
                          width: `${(d.contributes / maxWeight) * 100}%`,
                          background: d.contributes / Math.max(d.weight, 1) >= 0.6 ? "#639922" : "#EF9F27",
                        }}
                      />
                    </span>
                  </td>
                  <td className="w-16 py-1 text-right tabular-nums text-[var(--navy)]">
                    {Math.round(d.contributes)} / {Math.round(d.weight)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Weights are your stage&rsquo;s. The same work is worth a different number of points at another stage.
          </p>
        </div>
      </div>

      <div className={CARD}>
        <p className={LABEL}>Do these, in this order</p>

        {steps.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Every factor is already scored full at your stage. Nothing here would move the number.
          </p>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {steps.map((s, i) => (
                <div key={s.key}
                  className={`rounded-lg border border-[var(--border-subtle)] p-3 ${i === 0 ? "" : "opacity-95"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-medium text-[var(--navy)]">{s.action}</p>
                    <p className="whitespace-nowrap text-[12px] font-semibold text-emerald-700">
                      up to +{s.upTo} CRR
                    </p>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
                    {s.why} Currently {Math.round(s.pts)} of {Math.round(s.max)}.
                  </p>
                  <Link href={s.href}
                    className="mt-2 inline-block rounded-lg bg-[var(--blue)] px-3 py-1.5 text-xs font-semibold text-white">
                    {s.action.split(" ")[0]} →
                  </Link>
                </div>
              ))}
            </div>

            <p className="mt-3 rounded-lg border border-dashed border-[var(--border-subtle)] bg-slate-50/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
              {outreachUnlocked
                ? `These are worth up to ${reach.available} more points.`
                : reach.enough
                  ? `Together these are worth up to ${reach.available} points — enough to clear the gate.`
                  : `Together these are worth up to ${reach.available} points, ${reach.shortfall} short of the gate. Strengthening what you have already uploaded is what closes the rest.`}
              {" "}
              &ldquo;Up to&rdquo;, because each one is scored on what the document actually says. The number moves
              when the rating is re-run, not when a box is ticked.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
