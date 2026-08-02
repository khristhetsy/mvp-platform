"use client";

/**
 * Logo marquee (spec §5, §11). Scrolls a doubled logo track leftward; the
 * animation is CSS-scoped to prefers-reduced-motion: no-preference, so under
 * reduced motion it renders as a static row (true no-op). The second copy is
 * aria-hidden so screen readers hear each logo once. Hover pauses the scroll.
 */

type Logo = { id: string; name: string; logo_url: string };

export function LogoMarquee({ logos }: { logos: Logo[] }) {
  const doubled = [...logos, ...logos];
  return (
    <div className="site-marquee-host relative mt-6 overflow-hidden" role="list" aria-label="Client and portfolio companies">
      <ul className="site-marquee-track flex w-max items-center gap-x-12">
        {doubled.map((l, i) => (
          <li key={`${l.id}-${i}`} role="listitem" aria-hidden={i >= logos.length} className="flex shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={l.logo_url}
              alt={i < logos.length ? l.name : ""}
              height={28}
              className="h-7 w-auto opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"
              loading="lazy"
            />
          </li>
        ))}
      </ul>
      {/* Edge fades so logos ease in/out rather than clipping hard. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
    </div>
  );
}
