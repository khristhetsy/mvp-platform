"use client";

/**
 * Client copy of the company-wide admin Home settings (style, layout, start page).
 * One fetch per page load, shared by the layout, the Home page and the gear; a save
 * updates every consumer at once. The last value seen is cached in this browser so a
 * reload paints the right layout immediately.
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_ADMIN_HOME, normalizeAdminHome, type AdminHomeSettings } from "@/lib/settings/admin-home-shape";

const CACHE_KEY = "admin.home";
let state: AdminHomeSettings | null = null;
let cacheRead = false;
let loading = false;
const listeners = new Set<() => void>();

function emit(next: AdminHomeSettings) {
  state = next;
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

function load() {
  if (loading) return;
  loading = true;
  fetch("/api/feature-controls")
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { adminHome?: unknown } | null) => { if (d?.adminHome) emit(normalizeAdminHome(d.adminHome)); })
    .catch(() => { /* keep the cached or default value */ });
}

function snapshot(): AdminHomeSettings | null {
  if (!cacheRead) {
    cacheRead = true;
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (raw) state = normalizeAdminHome(JSON.parse(raw));
    } catch { /* ignore */ }
  }
  return state;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  load();
  return () => { listeners.delete(onChange); };
}
const noop = () => () => {};

/** The current settings (null until known in this browser). Pass false outside the admin workspace. */
export function useAdminHomeSettings(enabled = true): AdminHomeSettings | null {
  return useSyncExternalStore(enabled ? subscribe : noop, enabled ? snapshot : () => null, () => null);
}

/** Save a change for everyone (super admin only). Updates the screen first; returns an error message on failure. */
export async function saveAdminHomeSettings(patch: Partial<AdminHomeSettings>): Promise<string | null> {
  const prev = state ?? DEFAULT_ADMIN_HOME;
  emit(normalizeAdminHome({ ...prev, ...patch }));
  try {
    const res = await fetch("/api/admin/home-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json().catch(() => null)) as { adminHome?: unknown; error?: string } | null;
    if (!res.ok || !data?.adminHome) {
      emit(prev);
      return data?.error ?? "Couldn't save. Try again.";
    }
    emit(normalizeAdminHome(data.adminHome));
    return null;
  } catch {
    emit(prev);
    return "Couldn't save. Check your connection and try again.";
  }
}
