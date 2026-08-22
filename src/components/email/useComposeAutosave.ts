"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComposeDraft } from "./types";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";
export type AutosaveResult = { ok: true; savedAt: string } | { ok: false };

const DEBOUNCE_MS = 3000;
const BACKOFF_MS = [2000, 4000, 8000, 15000, 30000];

/** Exponential-with-cap retry delay for the Nth consecutive failure (0-based). */
export function backoffDelay(attempt: number): number {
  return BACKOFF_MS[Math.min(Math.max(0, attempt), BACKOFF_MS.length - 1)];
}
export const AUTOSAVE_DEBOUNCE_MS = DEBOUNCE_MS;

export interface ComposeAutosaveOptions {
  /** When false, the hook is inert (no timers, no listeners). */
  enabled: boolean;
  /** Reads the current draft synchronously (editor + fields). */
  getDraft: () => ComposeDraft;
  /** Persists the draft. Resolves ok + savedAt, or ok:false to trigger retry. */
  save: (draft: ComposeDraft) => Promise<AutosaveResult>;
  /** True when there's nothing worth saving (skip creating an empty draft). */
  isEmpty: (draft: ComposeDraft) => boolean;
  /** localStorage key for the crash/offline fallback buffer. */
  fallbackKey: string;
}

export interface ComposeAutosaveApi {
  status: AutosaveStatus;
  savedAt: string | null;
  /** Call on every edit — (re)arms the 3s debounce and writes the fallback buffer. */
  notifyChange: () => void;
  /** Save immediately (blur, close, minimize, tab-hide). Resolves after the save attempt. */
  flushNow: () => Promise<void>;
}

/** Write the crash buffer synchronously so nothing is lost on a hard unload. */
function writeFallback(key: string, draft: ComposeDraft) {
  try {
    localStorage.setItem(key, JSON.stringify({ draft, ts: Date.now() }));
  } catch { /* storage may be unavailable */ }
}
function clearFallback(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function useComposeAutosave(opts: ComposeAutosaveOptions): ComposeAutosaveApi {
  const { enabled, getDraft, save, isEmpty, fallbackKey } = opts;

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Keep the latest callbacks in refs so listeners/timers never go stale.
  const getDraftRef = useRef(getDraft);
  const saveRef = useRef(save);
  const isEmptyRef = useRef(isEmpty);
  useEffect(() => {
    getDraftRef.current = getDraft;
    saveRef.current = save;
    isEmptyRef.current = isEmpty;
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false); // a change arrived mid-save → save again after
  const retryRef = useRef(0);
  const runSaveRef = useRef<() => void>(() => {});

  const clearTimers = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (backoffRef.current) { clearTimeout(backoffRef.current); backoffRef.current = null; }
  }, []);

  const runSave = useCallback(async () => {
    clearTimers();
    const draft = getDraftRef.current();
    if (isEmptyRef.current(draft)) return; // never create an empty draft

    if (inFlightRef.current) { pendingRef.current = true; return; } // coalesce
    inFlightRef.current = true;
    setStatus("saving");

    let result: AutosaveResult;
    try {
      result = await saveRef.current(draft);
    } catch {
      result = { ok: false };
    }
    inFlightRef.current = false;

    if (result.ok) {
      retryRef.current = 0;
      setSavedAt(result.savedAt);
      setStatus("saved");
      clearFallback(fallbackKey);
      if (pendingRef.current) { pendingRef.current = false; runSaveRef.current(); } // save coalesced changes
    } else {
      setStatus("error");
      writeFallback(fallbackKey, draft); // keep the buffer until a save succeeds
      const wait = backoffDelay(retryRef.current);
      retryRef.current += 1;
      backoffRef.current = setTimeout(() => { runSaveRef.current(); }, wait);
    }
  }, [clearTimers, fallbackKey]);

  useEffect(() => { runSaveRef.current = () => { void runSave(); }; }, [runSave]);

  const notifyChange = useCallback(() => {
    if (!enabled) return;
    writeFallback(fallbackKey, getDraftRef.current());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void runSave(); }, DEBOUNCE_MS);
  }, [enabled, fallbackKey, runSave]);

  const flushNow = useCallback(async () => {
    if (!enabled) return;
    await runSave();
  }, [enabled, runSave]);

  // Global triggers: tab-hide flushes; unload writes the buffer synchronously.
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => { if (document.visibilityState === "hidden") void runSave(); };
    const onBeforeUnload = () => {
      const draft = getDraftRef.current();
      if (!isEmptyRef.current(draft)) writeFallback(fallbackKey, draft);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearTimers();
    };
  }, [enabled, fallbackKey, runSave, clearTimers]);

  return { status, savedAt, notifyChange, flushNow };
}
