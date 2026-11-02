"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { PromoSlide } from "@/lib/learning/overview-programs";

const THEMES = ["#0A1A40", "#185FA5", "#2D2A6E"];
const INTERVAL_MS = 6000;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion() {
  return window.matchMedia(REDUCED_MOTION).matches;
}

/**
 * Sliding promo banner for the Learning overview. One slide per program, driven by the list built in
 * overview-programs.ts. Advances on its own, pauses on hover or focus, stops for good once the founder
 * picks a slide, and does not move at all when the browser asks for reduced motion.
 */
export function LearningPromoBanner({ slides }: Readonly<{ slides: PromoSlide[] }>) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userMoved, setUserMoved] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);

  useEffect(() => {
    if (count < 2 || paused || userMoved || reduced) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, count, paused, userMoved, reduced]);

  if (count === 0) return null;

  function go(next: number) {
    setUserMoved(true);
    setIndex((next + count) % count);
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      aria-roledescription="carousel"
      aria-label="Featured learning programs"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-700 ease-in-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className="grid min-w-full grid-cols-1 items-center gap-5 px-6 pb-12 pt-6 text-white md:grid-cols-[1.35fr_1fr]"
            style={{ background: THEMES[i % THEMES.length] }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            inert={i !== index}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold tracking-[0.08em] text-[#A9C2FF]">{slide.eyebrow}</span>
                <span className="rounded-full bg-[#FFD24A] px-2.5 py-0.5 text-[11px] font-semibold text-[#3B2A00]">{slide.badge}</span>
              </div>
              <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">{slide.headline}</h2>
              <p className="mt-2 text-sm leading-6 text-[#D3DBEA]">{slide.blurb}</p>
              {slide.facts.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {slide.facts.map((fact) => (
                    <div key={fact.label} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs text-white">
                      <span className="block text-sm font-semibold">{fact.value}</span>
                      {fact.label}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  href={slide.cta.href}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#FFD24A] px-5 py-2.5 text-sm font-semibold text-[#2A1F00] hover:bg-[#FFDD70]"
                >
                  <i className="ti ti-player-play" aria-hidden="true" />
                  {slide.cta.label}
                </Link>
                {slide.secondary && (
                  <Link
                    href={slide.secondary.href}
                    className="rounded-lg border border-white/50 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                  >
                    {slide.secondary.label}
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white/10 p-3">
              {slide.preview.length > 0 ? (
                <>
                  <p className="mb-1 text-xs text-[#D3DBEA]">{slide.previewTitle}</p>
                  <ol>
                    {slide.preview.map((item, k) => (
                      <li key={`${item.label}-${k}`} className="flex items-center gap-2.5 border-t border-white/15 py-1.5 text-xs text-white first:border-t-0">
                        <span
                          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] ${
                            item.active ? "bg-white font-semibold text-[#0A1A40]" : "bg-white/20"
                          }`}
                        >
                          {k + 1}
                        </span>
                        {item.label}
                      </li>
                    ))}
                  </ol>
                </>
              ) : slide.imageUrl ? (
                <div
                  role="img"
                  aria-label={slide.headline}
                  className="h-40 rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url(${slide.imageUrl})` }}
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg bg-white/10 text-4xl" aria-hidden="true">
                  <i className="ti ti-school" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="absolute inset-x-6 bottom-3 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show slide ${i + 1}: ${slide.headline}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <i className="ti ti-chevron-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
