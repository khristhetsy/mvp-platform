import { describe, it, expect } from "vitest";
import {
  INVITE_ROLES,
  materialsComplete,
  outstandingMaterials,
  respondPath,
  validateVideoUrl,
} from "@/lib/icfo-events/invite-rules";

describe("video is a link, never a file", () => {
  it("accepts the hosts we can actually play", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://vimeo.com/76979871",
      "https://www.loom.com/share/abc123",
    ]) {
      expect(validateVideoUrl(url).ok, url).toBe(true);
    }
  });

  it("tells someone who pasted a filename where to put it", () => {
    const r = validateVideoUrl("my-pitch-final-v3.mp4");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/upload it to youtube, vimeo or loom/i);
  });

  it("rejects a host we can't embed, and says which ones work", () => {
    const r = validateVideoUrl("https://dropbox.com/s/xyz/pitch.mp4");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/youtube, vimeo and loom/i);
  });

  it("rejects the site itself rather than a video", () => {
    expect(validateVideoUrl("https://youtube.com").ok).toBe(false);
    expect(validateVideoUrl("https://vimeo.com/").ok).toBe(false);
  });

  it("rejects a non-http scheme", () => {
    expect(validateVideoUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateVideoUrl("file:///Users/me/pitch.mp4").ok).toBe(false);
  });

  it("assumes https when the scheme is missing", () => {
    const r = validateVideoUrl("vimeo.com/76979871");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toMatch(/^https:\/\//);
  });

  it("treats an empty field as a prompt, not an error about format", () => {
    const r = validateVideoUrl("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/add a link/i);
  });
});

describe("each role is only chased for what it was asked for", () => {
  it("wants a video and a deck from a showcase founder", () => {
    expect(outstandingMaterials("founder_showcase", { videoUrl: null, deckPath: null }))
      .toEqual(["Pitch video", "Pitch deck"]);
  });

  it("never asks an exhibitor for a pitch video", () => {
    expect(outstandingMaterials("exhibitor", { videoUrl: null, deckPath: "x.pdf" })).toEqual([]);
    expect(materialsComplete("exhibitor", { videoUrl: null, deckPath: "x.pdf" })).toBe(true);
  });

  it("asks a panel founder for nothing", () => {
    expect(materialsComplete("presenter", { videoUrl: null, deckPath: null })).toBe(true);
  });

  it("is complete once the asked-for items are in", () => {
    expect(materialsComplete("founder_showcase", { videoUrl: "https://vimeo.com/1", deckPath: "d.pdf" })).toBe(true);
  });
});

describe("where an invitee answers", () => {
  it("sends a founder with an account to their portal", () => {
    expect(respondPath("founder_showcase", true, "tok")).toBe("/founder/events/present");
  });

  it("sends an exhibitor to the signed link — they have no account", () => {
    expect(respondPath("exhibitor", false, "tok")).toBe("/e/invite/tok");
    expect(INVITE_ROLES.exhibitor.respondsInPortal).toBe(false);
  });

  it("keeps an exhibitor on the link even if they happen to have an account", () => {
    // The booth belongs to a company; the portal has no exhibitor surface.
    expect(respondPath("exhibitor", true, "tok")).toBe("/e/invite/tok");
  });

  it("falls back to the link when a founder has no account yet", () => {
    expect(respondPath("founder_showcase", false, "tok")).toBe("/e/invite/tok");
  });
});
