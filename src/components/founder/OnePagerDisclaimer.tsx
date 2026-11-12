/**
 * Compliance disclaimer shown at the bottom of the public one-pager (/f/[slug])
 * and of the founder preview, so both render identical wording.
 */
export const ONE_PAGER_DISCLAIMER_ID = "one-pager-disclaimer";

export function OnePagerDisclaimer() {
  return (
    <div
      id={ONE_PAGER_DISCLAIMER_ID}
      style={{
        display: "flex", gap: 8, alignItems: "flex-start",
        background: "#F1EFE8", border: "1px solid #D3D1C7", borderRadius: 10,
        padding: "10px 14px", marginTop: 28, fontSize: 12, lineHeight: 1.5, color: "#5F5E5A",
      }}
    >
      <span aria-hidden="true">ⓘ</span>
      <span>
        <b>Informational only.</b> This profile is not an offer to sell or a solicitation to buy securities, and
        not investment advice. Introductions are facilitated by iCapOS between the company and verified investors;
        any transaction occurs directly between the parties on their own terms. The Investable Score is a
        rules-based readiness signal, not a rating of the securities or investment advice.
      </span>
    </div>
  );
}
