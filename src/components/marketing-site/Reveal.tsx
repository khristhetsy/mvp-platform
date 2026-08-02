"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll reveal (spec §5, §11). Fades/rises children in when they enter the
 * viewport. Progressive-enhancement + reduced-motion safe:
 *  - Server renders children fully visible (no hidden class), so no-JS visitors
 *    and crawlers always see the content.
 *  - On mount, if the visitor hasn't asked to reduce motion, we add the hidden
 *    class and reveal on intersection. Under prefers-reduced-motion we do nothing
 *    (the CSS also scopes all motion to the no-preference query as a backstop).
 *  Uses classList (a DOM side-effect), never setState — no re-render churn.
 */
export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.add("site-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("site-reveal-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
