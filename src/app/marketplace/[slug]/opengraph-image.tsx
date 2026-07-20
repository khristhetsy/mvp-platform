import { ImageResponse } from "next/og";
import { getListingBySlug } from "@/lib/marketplace/queries";
import { formatAmountRange } from "@/lib/marketplace/format-amount";

export const alt = "Reg CF offering on iCapOS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// OG card for a marketplace listing detail page — built ONLY from tombstone-safe
// fields (company name, industry/location, security, raise range, portal). No
// pitch content. Falls back to a generic marketplace card for unknown/non-live slugs.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug).catch(() => null);

  const companyName = listing?.companyName ?? "Reg CF offering";
  const meta = [listing?.industry, listing?.location].filter(Boolean).join("  ·  ");
  const portal = listing?.portalName ?? null;
  const security = listing?.securityType ?? null;
  const range =
    listing && (listing.offeringAmountMin != null || listing.offeringAmountMax != null)
      ? formatAmountRange(listing.offeringAmountMin, listing.offeringAmountMax)
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(120deg, #0A1A40 0%, #143A80 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "#1A6CE4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              iC
            </div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>iCapOS</div>
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 1,
              color: "#0E9F6E",
              background: "#E6F7F0",
              padding: "8px 18px",
              borderRadius: 999,
            }}
          >
            REG CF
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.05 }}>{companyName}</div>
          {meta ? <div style={{ fontSize: 30, color: "#AEC3E8" }}>{meta}</div> : null}
          <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
            {security ? <Pill label={security} /> : null}
            {range ? <Pill label={range} /> : null}
            {portal ? <Pill label={`on ${portal}`} /> : null}
          </div>
        </div>

        <div style={{ fontSize: 22, color: "#93A6CC" }}>
          A notice of an offering on a registered funding portal. iCapOS is not a broker-dealer or funding portal.
        </div>
      </div>
    ),
    { ...size },
  );
}

function Pill({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 26,
        fontWeight: 600,
        color: "#ffffff",
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.22)",
        padding: "8px 20px",
        borderRadius: 12,
        display: "flex",
      }}
    >
      {label}
    </div>
  );
}
