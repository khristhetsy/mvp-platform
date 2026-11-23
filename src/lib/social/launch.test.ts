import { describe, expect, it } from "vitest";
import { livePostUrl, postState, screenForTab, setupProgress, stepRatioPct, weakestStage, type PostLike } from "./launch";

const post = (over: Partial<PostLike> = {}): PostLike => ({ status: "scheduled", held_until: null, archived_at: null, variants: [{ status: "queued" }], ...over });

describe("screenForTab", () => {
  it("maps every old tab link to a wizard or home", () => {
    expect(screenForTab("compose")).toBe("post");
    expect(screenForTab("settings")).toBe("connect");
    expect(screenForTab("campaigns")).toBe("campaign");
    expect(screenForTab("overview")).toBe("review");
    expect(screenForTab("attribution")).toBe("review");
    expect(screenForTab("library")).toBe("home");
    expect(screenForTab("schedule")).toBe("home");
    expect(screenForTab(null)).toBe("home");
    expect(screenForTab("nonsense")).toBe("home");
  });
});

describe("postState", () => {
  it("reads one state per post", () => {
    expect(postState(post()).key).toBe("scheduled");
    expect(postState(post({ status: "draft", variants: [{ status: "skipped" }] })).key).toBe("draft");
    expect(postState(post({ held_until: "2026-12-01T00:00:00Z", status: "draft" })).key).toBe("waiting");
    expect(postState(post({ archived_at: "2026-11-01T00:00:00Z" })).key).toBe("archived");
    expect(postState(post({ status: "published", variants: [{ status: "published", url: "https://x.test/1" }] })).key).toBe("published");
    expect(postState(post({ variants: [{ status: "failed" }] })).key).toBe("failed");
  });
  it("stays scheduled while some accounts are still waiting", () => {
    expect(postState(post({ variants: [{ status: "published" }, { status: "queued" }] })).key).toBe("scheduled");
  });
});

describe("livePostUrl", () => {
  it("returns the real network link only after publishing", () => {
    expect(livePostUrl(post())).toBeNull();
    expect(livePostUrl(post({ variants: [{ status: "queued", url: "https://www.linkedin.com/feed/update/urn:li:share:1" }] }))).toBeNull();
    expect(livePostUrl(post({ variants: [{ status: "published", url: "https://www.linkedin.com/feed/update/urn:li:share:1" }] }))).toBe("https://www.linkedin.com/feed/update/urn:li:share:1");
  });
  it("ignores a stored value that is not an http link", () => {
    expect(livePostUrl(post({ variants: [{ status: "published", url: "javascript:alert(1)" }] }))).toBeNull();
    expect(livePostUrl(post({ variants: [{ status: "published", url: null }] }))).toBeNull();
  });
});

describe("setupProgress", () => {
  it("marks each launch step from data", () => {
    const none = setupProgress({ accounts: [], campaigns: 0, posts: [], reviewed: false });
    expect(none.doneCount).toBe(0);
    const some = setupProgress({ accounts: [{ status: "connected" }], campaigns: 1, posts: [post()], reviewed: false });
    expect(some.steps.map((s) => s.done)).toEqual([true, true, true, false]);
    expect(some.doneCount).toBe(3);
  });
  it("does not count a draft or a disconnected account", () => {
    const r = setupProgress({ accounts: [{ status: "disconnected" }], campaigns: 0, posts: [post({ status: "draft", variants: [{ status: "skipped" }] })], reviewed: true });
    expect(r.steps.map((s) => s.done)).toEqual([false, false, false, true]);
  });
});

describe("weakestStage", () => {
  it("picks the stage furthest below goal", () => {
    expect(weakestStage([
      { stage: "outreach", actual: 12, target: 20 },
      { stage: "clicks", actual: 41, target: 60 },
      { stage: "meetings", actual: 2, target: 4 },
    ])).toEqual({ stage: "meetings", pct: 50, actual: 2, target: 4 });
  });
  it("returns null when nothing has a goal", () => {
    expect(weakestStage([{ stage: "clicks", actual: 5, target: null }, { stage: "meetings", actual: 1, target: 0 }])).toBeNull();
  });
});

describe("stepRatioPct", () => {
  it("is a whole percent of the previous stage", () => {
    expect(stepRatioPct(41, 2)).toBe(5);
    expect(stepRatioPct(0, 3)).toBeNull();
  });
});
