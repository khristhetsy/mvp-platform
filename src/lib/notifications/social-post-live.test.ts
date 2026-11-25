import { beforeEach, describe, expect, it, vi } from "vitest";

const profile = vi.hoisted(() => ({ value: null as null | { id: string; email: string | null; full_name: string | null; role: string | null } }));
const createNotification = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());
const shouldSendEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile.value }) }) }) }),
  }),
}));
vi.mock("@/lib/notifications/notifications", () => ({ createNotification }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail }));
vi.mock("@/lib/notifications/preferences", () => ({ shouldSendEmail }));

import { liveLink, networkName, notifyFounderPostLive, postLiveCopy, postLiveEmail } from "./social-post-live";

const base = { founderId: "f1", variantId: "v1", postId: "p1", platform: "linkedin", title: "Two early studies.", url: "https://www.linkedin.com/feed/update/1" };

beforeEach(() => {
  vi.clearAllMocks();
  profile.value = { id: "f1", email: "founder@example.com", full_name: "Ada Lovelace", role: "founder" };
  createNotification.mockResolvedValue({ id: "n1" });
  shouldSendEmail.mockResolvedValue(true);
  sendEmail.mockResolvedValue(undefined);
});

describe("copy", () => {
  it("names the network", () => {
    expect(networkName("linkedin")).toBe("LinkedIn");
    expect(networkName("reddit")).toBe("Reddit");
    expect(networkName("mastodon")).toBe("Mastodon");
    expect(networkName(null)).toBe("your account");
  });

  it("links only real web addresses", () => {
    expect(liveLink("https://x.com/p/1")).toBe("https://x.com/p/1");
    expect(liveLink("javascript:alert(1)")).toBeNull();
    expect(liveLink("")).toBeNull();
    expect(liveLink(null)).toBeNull();
  });

  it("writes the bell alert", () => {
    expect(postLiveCopy({ platform: "linkedin", title: "Hello" })).toEqual({ title: "Your post is live on LinkedIn", message: "Hello" });
    expect(postLiveCopy({ platform: "linkedin", title: "  " }).message).toBe("Your social post");
  });

  it("sends View on the network when there is a link, Your posts when there is not", () => {
    const withLink = postLiveEmail({ firstName: "Ada", platform: "linkedin", title: "T", url: "https://x.com/p/1", publishedAt: new Date("2026-11-25T09:01:00Z") });
    expect(withLink.subject).toBe("Your LinkedIn post is live");
    expect(withLink.html).toContain("View on LinkedIn");
    expect(withLink.html).toContain("https://x.com/p/1");
    const noLink = postLiveEmail({ firstName: null, platform: "facebook", title: "T", url: null, publishedAt: new Date() });
    expect(noLink.html).toContain("See your posts");
    expect(noLink.html).not.toContain("View on Facebook");
  });
});

describe("notifyFounderPostLive", () => {
  it("sends the bell alert and the email to a founder", async () => {
    const r = await notifyFounderPostLive(base);
    expect(r).toEqual({ notified: true, emailed: true });
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: "f1", type: "social_post_published", dedupeKey: "social_post_live:v1", deepLink: base.url,
    }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("founder@example.com");
  });

  it("opens Your posts when the network returned no link", async () => {
    await notifyFounderPostLive({ ...base, url: null });
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ deepLink: "/founder/deploy/social" }));
  });

  it("never notifies a post with no founder profile or a non founder", async () => {
    profile.value = null;
    expect(await notifyFounderPostLive(base)).toEqual({ notified: false, emailed: false });
    profile.value = { id: "s1", email: "staff@icapos.com", full_name: "Staff", role: "admin" };
    expect(await notifyFounderPostLive(base)).toEqual({ notified: false, emailed: false });
    expect(createNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("gives internal founder accounts the bell alert only", async () => {
    profile.value = { id: "f1", email: "demo@myicfos.com", full_name: "Demo", role: "founder" };
    const r = await notifyFounderPostLive(base);
    expect(r).toEqual({ notified: true, emailed: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips the email when the founder turned it off or it is quiet hours", async () => {
    shouldSendEmail.mockResolvedValue(false);
    const r = await notifyFounderPostLive(base);
    expect(r).toEqual({ notified: true, emailed: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("never throws into the publish queue", async () => {
    createNotification.mockRejectedValue(new Error("db down"));
    await expect(notifyFounderPostLive(base)).resolves.toEqual({ notified: false, emailed: false });
  });
});
