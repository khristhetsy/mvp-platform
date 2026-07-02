// Preference resolution: catalog default → per-admin prefs → gated by global settings.

import { NOTIF_TYPES, getNotifType, type Channel, type NotifKind } from "./catalog";
import { loadPrefs, loadSettings } from "./store";
import type { NotifPref, NotifSettings } from "./types";

export interface EffectiveType {
  enabled: boolean;
  channels: Channel[];
  cadence: string | null;
  urgent: boolean;
  kind: NotifKind;
}

/** Pure resolver — combine a catalog type with a per-admin pref row + global settings. */
export function resolve(typeId: string, prefRow: NotifPref | undefined, masterOn: boolean): EffectiveType | null {
  const t = getNotifType(typeId);
  if (!t) return null;
  return {
    enabled: masterOn && (prefRow?.enabled ?? t.defaultOn),
    channels: prefRow?.channels ?? t.defaultChannels,
    cadence: prefRow?.cadence ?? t.defaultCadence ?? null,
    urgent: t.urgent,
    kind: t.kind,
  };
}

/** Load-and-resolve a single type for an admin (used by the emit service). */
export async function getEffective(
  adminId: string,
  typeId: string,
): Promise<{ eff: EffectiveType | null; settings: NotifSettings }> {
  const [prefs, settings] = await Promise.all([loadPrefs(adminId), loadSettings(adminId)]);
  return { eff: resolve(typeId, prefs.get(typeId), settings.master_on), settings };
}

/** Full effective view for the settings UI: every catalog type + this admin's overrides. */
export async function getEffectiveAll(adminId: string): Promise<{
  settings: NotifSettings;
  rows: Array<{
    id: string;
    enabled: boolean;
    channels: Channel[];
    cadence: string | null;
    isOverride: boolean;
  }>;
}> {
  const [prefs, settings] = await Promise.all([loadPrefs(adminId), loadSettings(adminId)]);
  const rows = NOTIF_TYPES.map((t) => {
    const p = prefs.get(t.id);
    return {
      id: t.id,
      enabled: p?.enabled ?? t.defaultOn,
      channels: p?.channels ?? t.defaultChannels,
      cadence: p?.cadence ?? t.defaultCadence ?? null,
      isOverride: !!p,
    };
  });
  return { settings, rows };
}
