"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js so the browser will offer to install iCapOS (Chrome requires a
 * service worker before it fires `beforeinstallprompt`). The worker itself only
 * provides an offline fallback — it caches no app content.
 *
 * Production only: registering in dev causes confusing stale-page behaviour while
 * working locally.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => { void navigator.serviceWorker.register("/sw.js").catch(() => { /* non-fatal */ }); };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
