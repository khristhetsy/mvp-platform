"use client";

import { useId } from "react";

/** iCapOS emblem — a broken ring (gap at top) around ascending bars, navy→blue
 *  gradient. Pure SVG. Uses a unique gradient id per instance so multiple logos
 *  on one page all paint correctly. */
export function CapitalOSEmblem({
  size = 32,
  className = "",
}: Readonly<{ size?: number; className?: string }>) {
  const gradId = `icapos-emblem-${useId()}`;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="iCapOS emblem"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="14" y1="86" x2="86" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0B2A5B" />
          <stop offset="0.55" stopColor="#1E54C8" />
          <stop offset="1" stopColor="#2E8BFF" />
        </linearGradient>
      </defs>

      {/* Broken ring (gap at top) */}
      <circle
        cx="50"
        cy="50"
        r="39"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray="218 27"
        transform="rotate(-23 50 50)"
      />

      {/* Ascending bars */}
      <g fill={`url(#${gradId})`}>
        <rect x="30" y="57" width="8" height="17" rx="2" />
        <rect x="41" y="49" width="8" height="25" rx="2" />
        <rect x="52" y="41" width="8" height="33" rx="2" />
        <rect x="63" y="33" width="8" height="41" rx="2" />
      </g>
    </svg>
  );
}
