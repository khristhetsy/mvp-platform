import { describe, expect, it } from "vitest";
import {
  ACTIVITY_CLASSES,
  ALL_ACTIVITY_STAGES,
  FOUNDER_STAGES,
  INVESTOR_STAGES,
  activityClass,
  activityEventType,
  activityStageLabel,
  audienceOfStage,
  classKeyFromEventType,
  classesForAudience,
  classesForStage,
  isAccountActivityEvent,
  isActivityStage,
  stagesFor,
} from "@/lib/activity/stages";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";
import { INVESTOR_PIPELINE_STAGES } from "@/lib/investor-crm/pipeline-logic";

describe("the stage taxonomy tracks the real ones", () => {
  it("re-exports the founder journey stages rather than a copy", () => {
    // A second hard-coded list is how the feed's fold label ends up disagreeing
    // with the stage the founder is actually in.
    expect(FOUNDER_STAGES).toEqual(JOURNEY_STAGES);
  });

  it("re-exports the investor pipeline stages rather than a copy", () => {
    expect(INVESTOR_STAGES).toEqual(INVESTOR_PIPELINE_STAGES);
  });

  it("does not force investors into the founder's four stages", () => {
    expect(INVESTOR_STAGES).toHaveLength(5);
    expect(FOUNDER_STAGES).toHaveLength(4);
    expect(ALL_ACTIVITY_STAGES).toHaveLength(9);
  });

  it("labels founder stages with their ordinal and the admin mirror's name", () => {
    expect(activityStageLabel("qualify")).toBe("Stage 2 · Preparation");
    expect(activityStageLabel("optimize")).toBe("Stage 4 · Closing");
  });

  it("labels investor stages without an ordinal", () => {
    expect(activityStageLabel("engaged")).toBe("Engaged");
  });

  it("routes each stage to the right audience", () => {
    expect(audienceOfStage("deploy")).toBe("founder");
    expect(audienceOfStage("committed")).toBe("investor");
    expect(stagesFor("investor")).toEqual(INVESTOR_STAGES);
  });

  it("rejects a stage that is neither", () => {
    expect(isActivityStage("qualify")).toBe(true);
    expect(isActivityStage("closing")).toBe(false);
  });
});

describe("activity classes", () => {
  it("has unique keys", () => {
    const keys = ACTIVITY_CLASSES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("puts every class on a real stage", () => {
    for (const cls of ACTIVITY_CLASSES) {
      expect(isActivityStage(cls.stage)).toBe(true);
    }
  });

  it("gives every stage at least one class", () => {
    for (const stage of ALL_ACTIVITY_STAGES) {
      expect(classesForStage(stage).length).toBeGreaterThan(0);
    }
  });

  it("splits classes across the two audiences", () => {
    expect(classesForAudience("founder").length).toBeGreaterThan(0);
    expect(classesForAudience("investor").length).toBeGreaterThan(0);
    expect(classesForAudience("founder").length + classesForAudience("investor").length).toBe(
      ACTIVITY_CLASSES.length,
    );
  });
});

describe("destructive and threshold classes never wait for a digest", () => {
  // A deletion, a gate crossing, or an offering change after money has been
  // committed is worthless twelve hours late. These must be un-digestable in
  // the data, not merely switched off by default, or a well-meaning edit to the
  // preference screen quietly reintroduces the delay.
  const mustBeImmediate = [
    "document_deleted",
    "data_room_access_changed",
    "crr_gate_crossed",
    "outreach_below_gate",
    "offering_type_changed",
    "offering_changed_after_spv",
    "spv_participation_changed",
    "participation_withdrawn",
    "opted_out",
  ] as const;

  for (const key of mustBeImmediate) {
    it(`${key} is not digestable`, () => {
      const cls = activityClass(key);
      expect(cls).not.toBeNull();
      expect(cls?.digestable).toBe(false);
      expect(cls?.defaults.digest).toBe(false);
    });
  }

  it("never defaults a non-digestable class into the digest", () => {
    for (const cls of ACTIVITY_CLASSES) {
      if (!cls.digestable) expect(cls.defaults.digest).toBe(false);
    }
  });
});

describe("severity matches what the class means", () => {
  it("makes the two cross-stage judgement calls critical", () => {
    // Outreach below the gate, and an offering change after an SPV opened, are
    // the two events worth a phone call. Neither is a plain field change.
    expect(activityClass("outreach_below_gate")?.severity).toBe("critical");
    expect(activityClass("offering_changed_after_spv")?.severity).toBe("critical");
  });

  it("escalates those two past the stage owners", () => {
    expect(activityClass("outreach_below_gate")?.overrides).toContain("ceo");
    expect(activityClass("offering_changed_after_spv")?.overrides).toContain("ceo");
    expect(activityClass("offering_changed_after_spv")?.overrides).toContain("compliance");
  });

  it("sends every destructive class to compliance", () => {
    expect(activityClass("document_deleted")?.overrides).toContain("compliance");
    expect(activityClass("data_room_access_changed")?.overrides).toContain("compliance");
  });
});

describe("event types round-trip", () => {
  it("prefixes with the audience so it cannot collide with the 0044 system types", () => {
    expect(activityEventType("document_deleted")).toBe("founder.document_deleted");
    expect(activityEventType("participation_signed")).toBe("investor.participation_signed");
  });

  it("reads the class back off the event type", () => {
    for (const cls of ACTIVITY_CLASSES) {
      expect(classKeyFromEventType(activityEventType(cls.key))).toBe(cls.key);
    }
  });

  it("does not claim the pre-existing staff and system events", () => {
    // These have been written since 0044 and are not account activity.
    for (const type of ["digest_generated", "workflow_blocked", "act_on_behalf_started", "sent"]) {
      expect(isAccountActivityEvent(type)).toBe(false);
    }
  });
});
