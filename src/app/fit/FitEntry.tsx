"use client";

import { useEffect, useState } from "react";
import { FitFunnelClient } from "./FitFunnelClient";
import { FitFunnelV2 } from "./FitFunnelV2";

type Variant = "v1" | "v2";

/**
 * /fit entry: creates the funnel session, learns its A/B arm, then renders that
 * flow. v1 is the untouched control (its own session POST reuses the cookie set
 * here, so no duplicate row). `?v=1` / `?v=2` forces an arm for previews.
 */
export function FitEntry() {
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    fetch("/api/fit/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceTag: qs.get("s"), v: qs.get("v") }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setVariant(d?.variant === "v2" ? "v2" : "v1"))
      .catch(() => setVariant("v1"));
  }, []);

  if (variant === null) {
    return <div className="mx-auto h-40 w-full max-w-md" aria-busy="true" />;
  }
  return variant === "v2" ? <FitFunnelV2 /> : <FitFunnelClient />;
}
