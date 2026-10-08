import { fundsTextLines } from "@/lib/founder/use-of-funds";

// Inline styles, not Tailwind: like UseOfCapitalBar, this renders on the
// public one-pager, the founder preview embed and the PDF.

/**
 * The founder's full use-of-funds text under the allocation bar, so the
 * amount, timing, per-line detail and milestone are not lost when the bar is
 * drawn. Shows exactly what the founder wrote; ** marks become bold.
 */
export function UseOfFundsText({ text }: Readonly<{ text: string }>) {
  const lines = fundsTextLines(text);
  if (lines.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14, paddingTop: 14, borderTop: "1px solid #f3f4f6" }}>
      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            fontSize: 14,
            color: "#374151",
            margin: 0,
            lineHeight: 1.6,
            paddingLeft: line.kind === "para" ? 0 : 20,
            position: "relative",
          }}
        >
          {line.kind === "item" ? (
            <span style={{ position: "absolute", left: 0, color: "#6b7280" }}>{line.marker}</span>
          ) : null}
          {line.kind === "bullet" ? (
            <span style={{ position: "absolute", left: 4, top: "0.6em", width: 5, height: 5, borderRadius: "50%", background: "#6b7280" }} />
          ) : null}
          {line.parts.map((p, j) => (p.bold ? <strong key={j} style={{ fontWeight: 600, color: "#111827" }}>{p.text}</strong> : <span key={j}>{p.text}</span>))}
        </p>
      ))}
    </div>
  );
}
