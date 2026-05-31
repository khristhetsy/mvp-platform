"use client";

import Image from "next/image";
import { useState } from "react";
import {
  CAPITALOS_LOGO_SRC,
  CAPITALOS_LOGO_WIDTH_RATIO,
  DEFAULT_LOGO_HEIGHT,
  type CapitalOSLogoVariant,
} from "@/lib/ui/brand-logos";

export function CapitalOSLogo({
  variant = "wordmark",
  className = "",
  height,
  priority = false,
}: Readonly<{
  /** `full` — hero/marketing; `wordmark` — headers/nav; `icon` — sidebar/mobile */
  variant?: CapitalOSLogoVariant;
  className?: string;
  height?: number;
  priority?: boolean;
}>) {
  const [failed, setFailed] = useState(false);
  const resolvedHeight = height ?? DEFAULT_LOGO_HEIGHT[variant];
  const src = CAPITALOS_LOGO_SRC[variant];
  const width = Math.round(resolvedHeight * CAPITALOS_LOGO_WIDTH_RATIO[variant]);

  if (failed) {
    return (
      <span
        className={`inline-flex items-center gap-2 font-semibold tracking-tight text-[var(--navy)] ${className}`}
        style={{ fontSize: variant === "icon" ? 0 : resolvedHeight * 0.5 }}
        aria-label="CapitalOS"
      >
        {variant === "icon" ? (
          <span
            className="inline-block rounded-sm bg-[var(--gold)]"
            style={{ width: resolvedHeight, height: resolvedHeight }}
            aria-hidden
          />
        ) : (
          <>
            <span
              className="inline-block rounded-sm bg-[var(--gold)]"
              style={{ width: resolvedHeight * 0.35, height: resolvedHeight * 0.35 }}
              aria-hidden
            />
            CapitalOS
          </>
        )}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt="CapitalOS"
      width={width}
      height={resolvedHeight}
      className={`block h-auto max-w-full object-contain object-left ${className}`}
      style={{ height: resolvedHeight, width: "auto" }}
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
