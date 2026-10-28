"use client";

import { useEffect } from "react";

/** Sends the browser on to `href` after a short pause. The page also shows a button for anyone who does not want to wait. */
export function AutoRedirect({ href, seconds = 3 }: { href: string; seconds?: number }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.assign(href);
    }, seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [href, seconds]);
  return null;
}
