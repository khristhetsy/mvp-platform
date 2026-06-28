"use client";

import Image from "next/image";
import { useState } from "react";
import { CAPITALOS_LOGO_SRC, CAPITALOS_LOGO_WIDTH_RATIO } from "@/lib/ui/brand-logos";

export function CapitalOSLogo({
  className = "",
  height = 32,
  priority = false,
  variant = "full",
}: Readonly<{
  className?: string;
  height?: number;
  priority?: boolean;
  /** "full" = horizontal lockup (default), "stacked" = vertical lockup. */
  variant?: "full" | "stacked";
}>) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`inline-flex items-center gap-2 text-[length:inherit] font-semibold tracking-tight text-[var(--navy)] ${className}`}
        style={{ fontSize: height * 0.55 }}
      >
        <span className="rounded-sm bg-[var(--gold)]" style={{ width: height * 0.35, height: height * 0.35 }} aria-hidden />
        iCapOS
      </span>
    );
  }

  return (
    <Image
      src={CAPITALOS_LOGO_SRC[variant]}
      alt="iCapOS"
      width={Math.round(height * CAPITALOS_LOGO_WIDTH_RATIO[variant])}
      height={height}
      className={`h-auto w-auto object-contain ${variant === "stacked" ? "object-center" : "object-left"} ${className}`}
      style={{ height, width: "auto", maxWidth: "100%" }}
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
