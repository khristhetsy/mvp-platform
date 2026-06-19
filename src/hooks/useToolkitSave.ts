"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToolkitSaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Loads and auto-saves a raise toolkit tool's state to the DB via
 * /api/founder/toolkit/[toolKey].
 *
 * Usage:
 *   const { savedData, loaded, save, saveStatus } = useToolkitSave<MyState>("due-diligence");
 *
 *   // Hydrate component state once loaded:
 *   useEffect(() => {
 *     if (loaded && savedData) setCheckedIds(new Set(savedData.checkedIds));
 *   }, [loaded]);
 *
 *   // Debounce-save whenever state changes (skip until loaded):
 *   useEffect(() => {
 *     if (!loaded) return;
 *     save({ checkedIds: [...checkedIds] });
 *   }, [checkedIds, loaded]);
 */
export function useToolkitSave<T>(toolKey: string) {
  const [savedData, setSavedData] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ToolkitSaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetch(`/api/founder/toolkit/${toolKey}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { data: T | null }) => {
        if (mountedRef.current) {
          setSavedData(body.data ?? null);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (mountedRef.current) setLoaded(true);
      });

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toolKey]);

  const save = useCallback(
    (data: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (mountedRef.current) setSaveStatus("saving");

      timerRef.current = setTimeout(() => {
        fetch(`/api/founder/toolkit/${toolKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        })
          .then((res) => {
            if (!mountedRef.current) return;
            if (res.ok) {
              setSaveStatus("saved");
              setTimeout(() => {
                if (mountedRef.current) setSaveStatus("idle");
              }, 2000);
            } else {
              setSaveStatus("error");
            }
          })
          .catch(() => {
            if (mountedRef.current) setSaveStatus("error");
          });
      }, 800);
    },
    [toolKey],
  );

  return { savedData, loaded, save, saveStatus };
}
