/**
 * Compliance notes shown at the very bottom of the public one-pager (/f/[slug])
 * and of the founder preview, so both render identical wording. They sit last on the
 * page, in small print (5px): the SPV "Important disclosure" legend (SPV clients only)
 * and the "Informational only" disclaimer.
 */
export const ONE_PAGER_DISCLAIMER_ID = "one-pager-disclaimer";

const NOTE_STYLE = {
  background: "#F1EFE8",
  border: "1px solid #D3D1C7",
  borderRadius: 6,
  padding: "4px 7px",
  fontSize: 5,
  lineHeight: 1.4,
  color: "#5F5E5A",
} as const;

export function OnePagerDisclaimer({ spvLegend }: { spvLegend?: string }) {
  return (
    <div id={ONE_PAGER_DISCLAIMER_ID} style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 6 }}>
      {spvLegend ? (
        <p style={{ ...NOTE_STYLE, margin: 0 }}>
          <b>Important disclosure.</b> {spvLegend}
        </p>
      ) : null}
      <div style={{ ...NOTE_STYLE, display: "flex", gap: 6, alignItems: "flex-start" }}>
        <span aria-hidden="true">ⓘ</span>
        <span>
          <b>Informational only.</b> This profile is not an offer to sell or a solicitation to buy securities, and
          not investment advice. Introductions are facilitated by iCapOS between the company and verified investors;
          any transaction occurs directly between the parties on their own terms. The Investable Score is a
          rules-based readiness signal, not a rating of the securities or investment advice.
        </span>
      </div>
    </div>
  );
}
