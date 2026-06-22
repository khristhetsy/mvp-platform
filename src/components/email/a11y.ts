"use client";

// Small accessibility hooks for overlays (ContactCard, ComposeModal). Hand-rolled
// to avoid adding a popover/focus-trap dependency — the repo has none.

import { useEffect, useRef } from "react";

// A read-only element ref. Using `readonly current` makes the type covariant, so
// a RefObject<HTMLButtonElement> / RefObject<HTMLDivElement> is assignable here
// without casts.
type ReadRef = { readonly current: HTMLElement | null };

/** Calls `handler` when Escape is pressed, while `active`. */
export function useOnEscape(active: boolean, handler: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handler();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [active, handler]);
}

/**
 * Calls `handler` on pointer-down outside any of the given refs, while `active`.
 * Used for "click outside to close" on the contact card.
 */
export function useOutsideClick(
  active: boolean,
  refs: ReadonlyArray<ReadRef>,
  handler: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside = refs.some((r) => r.current && r.current.contains(target));
      if (!inside) handler();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [active, refs, handler]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab focus within `containerRef` while `active`, moves focus inside on
 * open, and restores focus to the previously-focused element on close.
 */
export function useFocusTrap(active: boolean, containerRef: ReadRef): void {
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Move focus inside the overlay.
    const first = focusable()[0];
    (first ?? container).focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      restoreRef.current?.focus?.();
    };
  }, [active, containerRef]);
}
