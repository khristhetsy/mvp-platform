"use client";

import { useSyncExternalStore } from "react";
import { ONE_PAGER_DISCLAIMER_ID } from "@/components/founder/OnePagerDisclaimer";

/**
 * Founder preview: one-time notice that a disclaimer now sits at the bottom of the one-pager.
 * The choice is remembered in this browser only (it is not saved to the account).
 * Purely informational: nothing here reads or saves profile data.
 */

const KEY = "icapos:one-pager:disclaimer-nudge-dismissed";
const CHANGED = "icapos:one-pager:disclaimer-nudge-changed";

// Kept in memory too, so Got it still works for the visit when the browser blocks storage.
let memoryDismissed = false;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function readDismissed(): boolean {
  if (memoryDismissed) return true;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed() {
  memoryDismissed = true;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* storage blocked: the notice comes back on the next visit */
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function OnePagerDisclaimerNudge() {
  // The server renders nothing; the notice appears right after load for a founder who has not dismissed it.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  if (dismissed) return null;

  function dismiss() {
    setDismissed();
  }

  return (
    <div
      role="status"
      style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12,
        padding: "12px 16px", marginBottom: 20, fontSize: 12, lineHeight: 1.5, color: "#1e3a8a",
      }}
    >
      <span aria-hidden="true">ⓘ</span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 2px" }}>
          A disclaimer was added to your one-pager
        </p>
        <p style={{ margin: 0 }}>
          It appears at the bottom of your one-pager, in place of the old footer note. Scroll down to review it.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <a
            href={`#${ONE_PAGER_DISCLAIMER_ID}`}
            onClick={dismiss}
            style={{
              fontSize: 11, fontWeight: 600, color: "white", background: "#2563eb",
              border: "1px solid #2563eb", borderRadius: 6, padding: "3px 10px", textDecoration: "none",
            }}
          >
            Review at the bottom
          </a>
          <button
            type="button"
            onClick={dismiss}
            style={{
              fontSize: 11, fontWeight: 600, color: "#1d4ed8", background: "white",
              border: "1px solid #93c5fd", borderRadius: 6, padding: "3px 10px", cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
