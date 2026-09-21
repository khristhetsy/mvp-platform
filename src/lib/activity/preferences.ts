/**
 * Per-class channel preferences for account activity.
 *
 * These live in the SAME `notification_preferences.events` jsonb the platform
 * already uses, under an `activity.` key prefix. No new table and no new column:
 * the existing settings screen reads only its own ten keys, so adding ours
 * beside them cannot disturb it, and quiet hours / pause-all / critical-override
 * keep applying to both without a second implementation.
 *
 * Pure except for `loadActivityChannelPrefs`, which is a thin wrapper over the
 * existing loader.
 */
import {
  type EventChannelPref,
  type NotificationPrefs,
  loadNotificationPrefs,
} from "@/lib/notifications/preferences";
import {
  ACTIVITY_CLASSES,
  type ActivityClassKey,
  activityClass,
} from "@/lib/activity/stages";

export const ACTIVITY_PREF_PREFIX = "activity.";

export type ActivityChannelPrefs = {
  classes: Partial<Record<ActivityClassKey, EventChannelPref>>;
};

export function activityPrefKey(classKey: ActivityClassKey): string {
  return `${ACTIVITY_PREF_PREFIX}${classKey}`;
}

/** Pull the activity rows out of an already-loaded preferences record. */
export function activityPrefsFrom(prefs: NotificationPrefs): ActivityChannelPrefs {
  const classes: Partial<Record<ActivityClassKey, EventChannelPref>> = {};
  for (const [key, value] of Object.entries(prefs.events ?? {})) {
    if (!key.startsWith(ACTIVITY_PREF_PREFIX)) continue;
    const classKey = key.slice(ACTIVITY_PREF_PREFIX.length) as ActivityClassKey;
    if (!activityClass(classKey)) continue;
    classes[classKey] = value;
  }
  return { classes };
}

export async function loadActivityChannelPrefs(userId: string): Promise<ActivityChannelPrefs> {
  return activityPrefsFrom(await loadNotificationPrefs(userId));
}

/**
 * The effective setting for one class — stored preference, else the class's own
 * defaults, so a class ships live rather than silently off.
 *
 * A class marked `digestable: false` can never report digest as on, whatever is
 * stored. That rule lives here as well as in the dispatcher because the settings
 * screen renders from this function: an un-digestable class must show a disabled
 * switch, not an on one that quietly does nothing.
 */
export function effectiveClassPref(
  prefs: ActivityChannelPrefs,
  classKey: ActivityClassKey,
): EventChannelPref {
  const cls = activityClass(classKey);
  if (!cls) return { in_app: false, email: false, digest: false };
  const stored = prefs.classes[classKey] ?? cls.defaults;
  return { ...stored, digest: cls.digestable ? stored.digest : false };
}

/** Build the `events` patch for a save, leaving every non-activity key alone. */
export function activityEventsPatch(
  current: NotificationPrefs["events"],
  updates: Partial<Record<ActivityClassKey, EventChannelPref>>,
): NotificationPrefs["events"] {
  const next = { ...current };
  for (const [classKey, value] of Object.entries(updates) as Array<
    [ActivityClassKey, EventChannelPref]
  >) {
    const cls = activityClass(classKey);
    if (!cls) continue;
    next[activityPrefKey(classKey)] = {
      ...value,
      digest: cls.digestable ? value.digest : false,
    };
  }
  return next;
}

/** Every class with its effective setting — what the settings screen renders. */
export function activityPrefRows(prefs: ActivityChannelPrefs) {
  return ACTIVITY_CLASSES.map((cls) => ({
    cls,
    pref: effectiveClassPref(prefs, cls.key),
  }));
}
