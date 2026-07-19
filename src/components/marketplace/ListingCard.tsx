import { marketplaceCopy } from "@/lib/marketplace/copy";
import { formatAmountRange } from "@/lib/marketplace/format-amount";
import { isSafePortalHref } from "@/lib/marketplace/portal-allowlist";
import type { Listing } from "@/lib/marketplace/queries";
import { ExpressInterest } from "./ExpressInterest";

const C = marketplaceCopy.card;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function logoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${path}`;
}

export function ListingCard({ listing, defaultOpen = false }: Readonly<{ listing: Listing; defaultOpen?: boolean }>) {
  // Render-time guard: never link a non-https portal. Omit the card entirely.
  if (!isSafePortalHref(listing.portalUrl)) {
    console.error(`[marketplace] omitting listing ${listing.id}: non-https portal_url`);
    return null;
  }

  const meta = [listing.industry, listing.location].filter(Boolean).join(" · ");

  return (
    <article
      aria-label={listing.companyName}
      className="flex flex-col gap-3 rounded-[14px] border border-[#E3E8F2] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(10,26,64,.08)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-center gap-3">
        {listing.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl(listing.logoPath)}
            alt=""
            className="h-[42px] w-[42px] rounded-[10px] object-cover"
          />
        ) : (
          <span
            className="grid h-[42px] w-[42px] place-items-center rounded-[10px] bg-[linear-gradient(135deg,#0A1A40,#1A6CE4)] text-[15px] font-bold text-white"
            aria-hidden="true"
          >
            {initials(listing.companyName)}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[15.5px] font-semibold text-[#16223F]">{listing.companyName}</div>
          {meta ? <div className="mt-px text-[12px] text-[#5A6782]">{meta}</div> : null}
        </div>
        <span className="ml-auto whitespace-nowrap rounded-full bg-[#E6F7F0] px-2.5 py-[3px] text-[10.5px] font-bold tracking-[0.4px] text-[#0E9F6E]">
          {C.badge}
        </span>
      </div>

      <p className="text-[13px] leading-[1.55] text-[#5A6782]">{listing.briefDescription}</p>

      <dl className="grid grid-cols-2 gap-2 text-[12px]">
        <Term label={C.terms.security} value={listing.securityType ?? "—"} />
        <Term label={C.terms.raiseRange} value={formatAmountRange(listing.offeringAmountMin, listing.offeringAmountMax)} />
        <Term label={C.terms.readiness} value={listing.readinessBand ?? "—"} />
        <Term label={C.terms.portal} value={listing.portalName} />
      </dl>

      <ExpressInterest
        listingId={listing.id}
        portalName={listing.portalName}
        portalUrl={listing.portalUrl}
        defaultOpen={defaultOpen}
      />

      <p className="border-t border-[#E3E8F2] pt-2.5 text-[10.5px] leading-[1.5] text-[#6B7690]">{C.disclosure}</p>
    </article>
  );
}

function Term({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg bg-[#F6F8FC] px-2.5 py-2">
      <dt className="text-[10.5px] uppercase tracking-[0.5px] text-[#5A6782]">{label}</dt>
      <dd className="mt-0.5 text-[12.5px] font-semibold text-[#16223F]">{value}</dd>
    </div>
  );
}
