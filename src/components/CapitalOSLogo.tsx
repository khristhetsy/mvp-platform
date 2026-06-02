"use client";

import Image from "next/image";
import { useState } from "react";
import { CAPITALOS_LOGO_SRC, CAPITALOS_LOGO_WIDTH_RATIO } from "@/lib/ui/brand-logos";

export function CapitalOSLogo({
  className = "",
  height = 32,
  priority = false,
}: Readonly<{
  className?: string;
  height?: number;
  priority?: boolean;
}>) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`inline-flex items-center gap-2 text-[length:inherit] font-semibold tracking-tight text-[var(--navy)] ${className}`}
        style={{ fontSize: height * 0.55 }}
      >
        <span className="rounded-sm bg-[var(--gold)]" style={{ width: height * 0.35, height: height * 0.35 }} aria-hidden />
        CapitalOS
      </span>
    );
  }

  return (
    <Image
      src={CAPITALOS_LOGO_SRC.full}
      alt="CapitalOS"
      width={Math.round(height * CAPITALOS_LOGO_WIDTH_RATIO.full)}
      height={height}
      className={`h-auto w-auto object-contain object-left ${className}`}
      style={{ height, width: "auto", maxWidth: "100%" }}
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
