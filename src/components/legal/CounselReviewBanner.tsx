/**
 * Marks a legal/trust page body as not yet reviewed by counsel. The page
 * structure and headings are scaffolded; the copy is provisional until legal
 * sign-off. Keep this visible until counsel approves the page.
 */
export function CounselReviewBanner() {
  return (
    <div
      role="note"
      className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <span className="font-semibold uppercase tracking-wide">Draft — pending counsel review.</span>{" "}
      This page is provisional and not yet reviewed by legal counsel. It does not constitute the final
      published policy.
    </div>
  );
}
