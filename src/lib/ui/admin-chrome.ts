"use client";

/**
 * Admin workspace chrome density. "compact" (default) is the Odoo-style layout: one
 * 44px top bar carrying the hub tabs, an icon rail instead of the 256px sidebar, no
 * page heading block. "classic" is the previous layout, kept as an escape hatch.
 * Stored per browser in localStorage; every consumer updates on change.
 */
import { useEffect, useState } from "react";

export type AdminChrome = "compact" | "classic";
const KEY = "admin.chrome";
const EVENT = "admin-chrome-change";

export function readAdminChrome(): AdminChrome {
  if (typeof window === "undefined") return "compact";
  try { return window.localStorage.getItem(KEY) === "classic" ? "classic" : "compact"; } catch { return "compact"; }
}

export function setAdminChrome(next: AdminChrome) {
  try { window.localStorage.setItem(KEY, next); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useAdminChrome(): AdminChrome {
  // Render compact on the server and first paint; a "classic" user re-renders once.
  const [chrome, setChrome] = useState<AdminChrome>("compact");
  useEffect(() => {
    const sync = () => setChrome(readAdminChrome());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return chrome;
}
