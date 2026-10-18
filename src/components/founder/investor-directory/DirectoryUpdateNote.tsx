"use client";

import { useSyncExternalStore } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * Founder › Investor directory: a note that the directory data updates constantly,
 * with a Hide option. The choice is remembered in this browser only (it is not saved
 * to the account) and covers all four tabs, because the note sits above them.
 * Hiding leaves a "Show update note" link beside "How the Investor directory works".
 * Purely informational: nothing here reads or saves directory data.
 */

const KEY = "icapos:investor-directory:update-note-hidden";
const CHANGED = "icapos:investor-directory:update-note-changed";

type Locale = "en" | "es";

const COPY: Record<Locale, { title: string; body: string; hide: string; show: string }> = {
  en: {
    title: "This directory updates constantly",
    body: "New investors and firms are added and existing details are refreshed all the time. Check back often for new investors.",
    hide: "Hide",
    show: "Show update note",
  },
  es: {
    title: "Este directorio se actualiza constantemente",
    body: "Se agregan nuevos inversionistas y empresas y se actualizan los datos todo el tiempo. Vuelva a revisar con frecuencia para ver nuevos inversionistas.",
    hide: "Ocultar",
    show: "Mostrar aviso de actualización",
  },
};

// Kept in memory too, so Hide still works for the visit when the browser blocks storage.
let memoryHidden = false;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function readHidden(): boolean {
  if (memoryHidden) return true;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function setHidden(hidden: boolean) {
  memoryHidden = hidden;
  try {
    if (hidden) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the note comes back on the next visit */
  }
  window.dispatchEvent(new Event(CHANGED));
}

function useHidden(): boolean {
  // The server always renders the note; a founder who hid it sees it collapse right after load.
  return useSyncExternalStore(subscribe, readHidden, () => false);
}

export function UpdateNoteBanner({ locale = "en" }: Readonly<{ locale?: Locale }>) {
  const hidden = useHidden();
  if (hidden) return null;
  const c = COPY[locale];
  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-3.5 text-[#0C447C]">
      <RefreshCw className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{c.title}</p>
        <p className="text-[13px]">{c.body}</p>
      </div>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#B5D4F4] px-2.5 py-1 text-xs hover:bg-white/60"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        {c.hide}
      </button>
    </div>
  );
}

export function UpdateNoteShowLink({ locale = "en" }: Readonly<{ locale?: Locale }>) {
  const hidden = useHidden();
  if (!hidden) return null;
  return (
    <button
      type="button"
      onClick={() => setHidden(false)}
      className="mb-3 ml-5 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
    >
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      {COPY[locale].show}
    </button>
  );
}
