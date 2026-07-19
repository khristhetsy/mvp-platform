import type { ReactNode } from "react";

// Reusable always-visible info banner (royal-soft, 4px royal left border, info
// icon). Never a tooltip or accordion. Matches the onboarding mockup.
export function DisclosureBanner({
  heading,
  children,
}: Readonly<{ heading: string; children: ReactNode }>) {
  return (
    <div
      role="note"
      className="mb-6 flex gap-3 rounded-[10px] border border-[#C9DCF9] border-l-4 border-l-[#1A6CE4] bg-[#EAF1FD] px-4 py-3.5 text-[13.5px] leading-[1.55] text-[#1F3A66]"
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke="#1A6CE4" strokeWidth="1.6" />
          <rect x="9.2" y="8.6" width="1.6" height="6" rx=".8" fill="#1A6CE4" />
          <circle cx="10" cy="5.9" r="1" fill="#1A6CE4" />
        </svg>
      </span>
      <div>
        <strong className="text-[#0A1A40]">{heading}</strong> {children}
      </div>
    </div>
  );
}
