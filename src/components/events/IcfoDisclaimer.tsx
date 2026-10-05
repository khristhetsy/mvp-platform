/** The iCFO Capital disclaimer shown on founder and investor facing event
 *  surfaces (Spotlight player, application form, founder booths). */
export function IcfoDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-[var(--text-muted)] ${className}`}>
      iCFO Capital Global, Inc. and iCapOS do not solicit, offer or sell securities, and nothing here is an offer to sell or a
      solicitation of an offer to buy any security. iCFO Capital Global, Inc. is not an investment adviser and does not give
      investment, legal or tax advice. Founder presentations, booths, matches and introductions are for educational and
      informational purposes only. Founders are responsible for their own statements. Investors should do their own due diligence.
    </p>
  );
}
