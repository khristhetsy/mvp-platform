import { describe, expect, it } from "vitest";
import {
  ACTIVITY_PREF_PREFIX,
  activityEventsPatch,
  activityPrefKey,
  activityPrefsFrom,
  effectiveClassPref,
} from "@/lib/activity/preferences";
import { DEFAULT_PREFS, type NotificationPrefs } from "@/lib/notifications/preferences";
import { activityClass } from "@/lib/activity/stages";

function prefsWith(events: NotificationPrefs["events"]): NotificationPrefs {
  return { ...DEFAULT_PREFS, events };
}

describe("activity preferences share the existing events jsonb", () => {
  it("namespaces its keys so it cannot collide with the platform's ten", () => {
    expect(activityPrefKey("document_deleted")).toBe(`${ACTIVITY_PREF_PREFIX}document_deleted`);
    expect(activityPrefKey("document_deleted")).not.toBe("document_uploaded");
  });

  it("reads back only the activity keys", () => {
    const parsed = activityPrefsFrom(
      prefsWith({
        ...DEFAULT_PREFS.events,
        "activity.crr_moved": { in_app: false, email: false, digest: true },
      }),
    );
    expect(parsed.classes.crr_moved).toEqual({ in_app: false, email: false, digest: true });
    // The platform's own keys are not activity classes and must not appear.
    expect(Object.keys(parsed.classes)).not.toContain("new_founder_signup");
  });

  it("ignores an activity key for a class that no longer exists", () => {
    const parsed = activityPrefsFrom(
      prefsWith({ "activity.retired_class": { in_app: true, email: true, digest: true } }),
    );
    expect(Object.keys(parsed.classes)).toHaveLength(0);
  });
});

describe("writing never tramples the other screen's keys", () => {
  it("leaves every non-activity key untouched", () => {
    // Both settings screens edit the same row. A patch that replaced `events`
    // wholesale would silently reset the platform's ten event toggles.
    const before = prefsWith(DEFAULT_PREFS.events);
    const after = activityEventsPatch(before.events, {
      crr_moved: { in_app: true, email: true, digest: true },
    });
    for (const key of Object.keys(DEFAULT_PREFS.events)) {
      expect(after[key]).toEqual(DEFAULT_PREFS.events[key]);
    }
    expect(after["activity.crr_moved"]).toEqual({ in_app: true, email: true, digest: true });
  });

  it("refuses to store digest:true for a class that cannot be digested", () => {
    const after = activityEventsPatch(
      {},
      { document_deleted: { in_app: true, email: true, digest: true } },
    );
    expect(after["activity.document_deleted"]).toEqual({
      in_app: true,
      email: true,
      digest: false,
    });
  });
});

describe("effective settings", () => {
  it("falls back to the class's own defaults when nothing is stored", () => {
    // A class with no stored row must be LIVE, not silently off — otherwise a
    // newly shipped class notifies nobody until someone visits the screen.
    const pref = effectiveClassPref({ classes: {} }, "document_deleted");
    expect(pref).toEqual(activityClass("document_deleted")!.defaults);
    expect(pref.in_app).toBe(true);
  });

  it("forces digest off for a non-digestable class even if stored on", () => {
    // Guards the case where a row was written before the class was marked
    // un-digestable: the rule lives in the reader, not only in the writer.
    const pref = effectiveClassPref(
      { classes: { crr_gate_crossed: { in_app: true, email: true, digest: true } } },
      "crr_gate_crossed",
    );
    expect(pref.digest).toBe(false);
  });

  it("keeps a stored digest choice for a class that allows it", () => {
    const pref = effectiveClassPref(
      { classes: { crr_moved: { in_app: false, email: false, digest: true } } },
      "crr_moved",
    );
    expect(pref).toEqual({ in_app: false, email: false, digest: true });
  });
});
