"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Blocking prompt shown to founders who haven't yet attested their capital
// structure (offering_type). Dual-lane spec §8, Step 2. Suppressed on the
// onboarding + offering-type routes themselves so it never blocks the very page
// used to resolve it.
const SUPPRESS_PREFIXES = ["/founder/offering-type", "/founder/onboarding"];

export function OfferingTypePrompt({ needsClassification }: Readonly<{ needsClassification: boolean }>) {
  const pathname = usePathname();
  if (!needsClassification) return null;
  if (SUPPRESS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offering-prompt-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF1FD]" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="#1A6CE4" strokeWidth="1.6" />
            <rect x="9.2" y="8.6" width="1.6" height="6" rx=".8" fill="#1A6CE4" />
            <circle cx="10" cy="5.9" r="1" fill="#1A6CE4" />
          </svg>
        </div>
        <h2 id="offering-prompt-title" className="text-lg font-bold text-[#0A1A40]">
          One quick step: your capital structure
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#5A6782]">
          Tell us how you&apos;re raising so iCapOS connects you with investors the right way. Reg CF offerings can appear
          on the public marketplace; private (Reg D) raises stay off public pages and use private matching instead. It
          takes under a minute.
        </p>
        <Link
          href="/founder/offering-type"
          className="mt-5 inline-flex w-full items-center justify-center rounded-[10px] bg-gradient-to-r from-[#0A1A40] to-[#1A6CE4] px-5 py-3 text-sm font-semibold text-white"
        >
          Set your capital structure
        </Link>
        <p className="mt-3 text-center text-[11px] text-[#8B96AC]">
          Until this is set, your company won&apos;t appear on any public surface.
        </p>
      </div>
    </div>
  );
}
