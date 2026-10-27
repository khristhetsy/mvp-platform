"use client";

import { useSyncExternalStore } from "react";

const KEY_PREFIX = "icapos.admin.companyHeader.hidden";

const CHANGE_EVENT = "icapos-company-header-hidden";

function storageKey(companyId: string, item: string) {
  return `${KEY_PREFIX}.${companyId}.${item}`;
}

function readHidden(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * A company header item with its own x. Hiding it removes it for this company
 * only, and a small Show link brings it back. The choice is kept in this
 * browser, so nothing is stored on the company itself.
 */
export function HideableHeaderItem({
  companyId,
  item,
  showLabel,
  children,
}: Readonly<{
  companyId: string;
  /** Short id for this item, so each one hides on its own. */
  item: string;
  /** The link text that brings it back, e.g. "Show welcome letter status". */
  showLabel: string;
  children: React.ReactNode;
}>) {
  const key = storageKey(companyId, item);
  // The server always renders the item visible; the browser then applies the saved choice.
  const hidden = useSyncExternalStore(subscribe, () => readHidden(key), () => false);

  function set(next: boolean) {
    try {
      if (next) window.localStorage.setItem(key, "1");
      else window.localStorage.removeItem(key);
    } catch {
      // storage unavailable: the item stays as it is
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  if (hidden) {
    return (
      <button type="button" onClick={() => set(false)} className="text-xs font-medium text-blue-700 hover:underline">
        {showLabel}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        onClick={() => set(true)}
        aria-label={`Hide: ${showLabel.replace(/^Show /, "")}`}
        title="Hide for this company"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        ×
      </button>
    </span>
  );
}
