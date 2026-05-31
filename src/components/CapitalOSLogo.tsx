"use client";

import Image from "next/image";
import { useState } from "react";

const LOGO_SRC = "/capitalos-logo.png";

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
      src={LOGO_SRC}
      alt="CapitalOS"
      width={Math.round(height * 3.2)}
      height={height}
      className={`h-auto w-auto object-contain object-left ${className}`}
      style={{ height, width: "auto", maxWidth: "100%" }}
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
