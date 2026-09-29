"use client";

import { useEffect, useRef } from "react";

/**
 * Close a popover on outside click or Escape — the behaviour every one of these
 * menus needs, and the part that quietly goes missing when each one rolls its own.
 *
 * Attach the returned ref to the element that wraps BOTH the trigger and the
 * panel, so clicking the trigger to close doesn't register as an outside click.
 */
export function useDismiss<T extends HTMLElement = HTMLDivElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}
