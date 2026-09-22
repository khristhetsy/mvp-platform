import { unallocated, type FundsSlice } from "@/lib/founder/use-of-funds";

// Inline styles, not Tailwind: the one-pager is rendered into an embed and a
// PDF as well as a page, and carries its own palette.
const COLOURS = ["#378ADD", "#7F77DD", "#1D9E75", "#EF9F27", "#D4537E", "#888780"];

/**
 * Where the money goes, as a bar.
 *
 * Drawn only when the founder's own text clearly describes an allocation —
 * `parseUseOfFunds` returns null otherwise and the caller shows the prose.
 */
export function UseOfCapitalBar({ slices }: Readonly<{ slices: FundsSlice[] }>) {
  const rest = unallocated(slices);
  const parts = rest > 0 ? [...slices, { label: "Unallocated", percent: rest }] : slices;

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {parts.map((p, i) => (
          <span
            key={p.label}
            title={`${p.label} ${p.percent}%`}
            style={{
              height: 10,
              width: `${p.percent}%`,
              borderRadius: 5,
              background: p.label === "Unallocated" ? "#D3D1C7" : COLOURS[i % COLOURS.length],
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {parts.map((p, i) => (
          <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#374151" }}>
            <span style={{
              width: 8, height: 8, borderRadius: 2,
              background: p.label === "Unallocated" ? "#D3D1C7" : COLOURS[i % COLOURS.length],
            }} />
            {p.percent}% {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
