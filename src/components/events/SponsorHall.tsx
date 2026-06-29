import Link from "next/link";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import type { EventSponsor, SponsorTier } from "@/lib/icfo-events/types";

const TIER_ORDER: SponsorTier[] = ["presenting", "gold", "silver", "community"];
const TIER_LABEL: Record<SponsorTier, string> = {
  presenting: "Presenting",
  gold: "Gold",
  silver: "Silver",
  community: "Community",
};
const SQUARE_BG = ["#0c2340", "#27500A", "#534AB7", "#185FA5", "#993C1D"];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function boothHref(s: EventSponsor): string {
  return `/events/sponsors/${s.id}`;
}

function isFeatured(s: EventSponsor): boolean {
  return s.placement === "presenting" || s.tier === "presenting";
}

export function SponsorHall({ sponsors }: { sponsors: EventSponsor[] }) {
  const featured = sponsors.find(isFeatured) ?? null;
  const rest = sponsors.filter((s) => s !== featured).sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));

  return (
    <div className="p-4 sm:p-5">
      <h1 className="text-xl font-semibold text-[var(--navy)]">
        Sponsor Hall {sponsors.length > 0 && <span className="text-[var(--text-muted)]">· {sponsors.length} booth{sponsors.length === 1 ? "" : "s"}</span>}
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Booths by tier with the presenting partner featured. Visit booths, grab resources, request an intro.
      </p>

      {sponsors.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--text-muted)]">No sponsors yet for this event.</p>
      ) : (
        <>
          {featured && (
            <Link
              href={boothHref(featured)}
              className="mt-5 flex items-center gap-4 rounded-xl border-2 border-[var(--blue)] bg-white p-4 transition hover:bg-slate-50"
            >
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-white"
                style={{ background: SQUARE_BG[0] }}
              >
                {initials(featured.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-medium text-[var(--navy)]">{featured.name}</span>
                  <span className="rounded-full bg-[var(--blue-muted)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--blue-hover)]">
                    Presenting{featured.sectorSlug ? ` · ${sectorLabel(featured.sectorSlug)}` : ""}
                  </span>
                </div>
                {featured.blurb && <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{featured.blurb}</p>}
              </div>
              <span className="shrink-0 rounded-lg bg-[var(--teal,#1D9E75)] px-4 py-2 text-xs font-medium text-white" style={{ background: "#1D9E75" }}>
                Enter booth ↗
              </span>
            </Link>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((s, i) => (
              <Link
                key={s.eventSponsorId}
                href={boothHref(s)}
                className="rounded-xl border border-[var(--border-subtle)] bg-white p-3.5 transition hover:bg-slate-50"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-medium text-white"
                  style={{ background: SQUARE_BG[(i + 1) % SQUARE_BG.length] }}
                >
                  {initials(s.name)}
                </span>
                <p className="mt-2.5 text-sm font-medium text-[var(--navy)]">{s.name}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {TIER_LABEL[s.tier]}
                  {s.sectorSlug ? ` · ${sectorLabel(s.sectorSlug)}` : ""}
                </p>
                <span className="mt-2.5 inline-block rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                  Enter
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Visits are tracked as aggregate counts for sponsors. Intros are opt-in only.
          </p>
        </>
      )}
    </div>
  );
}
