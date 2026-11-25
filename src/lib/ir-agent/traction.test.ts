import { describe, expect, it } from "vitest";
import { buildTraction, changePct, channelOf, departmentOf, placementsFor, type PostRow, type TractionAgent, type TractionConversation, type VariantRow } from "./traction";

const NOW = new Date("2026-11-25T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const agents: TractionAgent[] = [
  { id: "a", name: "Jessica", companyName: "iCFO", agentType: "marketing", imageUrl: null },
  { id: "b", name: "Bill", companyName: "iCFO", agentType: "sales", imageUrl: null },
  { id: "c", name: "Quiet", companyName: "Acme", agentType: null, imageUrl: null },
];
const conv = (agent_id: string, ago: number, source: string | null = null, booked = false): TractionConversation => ({
  agent_id,
  source,
  created_at: daysAgo(ago),
  booked_at: booked ? daysAgo(ago) : null,
});

describe("changePct", () => {
  it("measures against the previous period", () => {
    expect(changePct(15, 10)).toBe(50);
    expect(changePct(5, 10)).toBe(-50);
  });
  it("is null with no base to compare", () => {
    expect(changePct(4, 0)).toBeNull();
  });
});

describe("channelOf", () => {
  it("groups free form tags", () => {
    expect(channelOf(null)).toBe("Direct");
    expect(channelOf("direct")).toBe("Direct");
    expect(channelOf("linkedin-sept")).toBe("LinkedIn");
    expect(channelOf("email-nov-campaign")).toBe("Email");
    expect(channelOf("pe-expo-paris")).toBe("Event");
    expect(channelOf("something-else")).toBe("Other");
    expect(channelOf("li-abc123")).toBe("LinkedIn");
    expect(channelOf("em_nov")).toBe("Email");
    expect(channelOf("web-home")).toBe("Website");
    expect(channelOf("rd_post")).toBe("Social media");
  });
});

describe("departmentOf", () => {
  it("uses the agent type label, founder when unset", () => {
    expect(departmentOf("sales")).toBe("Sales");
    expect(departmentOf(null)).toBe("Founder");
  });
});

describe("buildTraction", () => {
  const rows = [
    conv("a", 1, "linkedin-a"), conv("a", 2, "linkedin-a", true), conv("a", 3), conv("a", 40),
    conv("b", 5, "email-x"), conv("b", 35), conv("b", 36), conv("b", 37),
    conv("zzz", 1),
    conv("a", 200),
  ];
  const t = buildTraction(agents, rows, 30, NOW);

  it("ranks by conversations in the period", () => {
    expect(t.agents.map((a) => a.name)).toEqual(["Jessica", "Bill", "Quiet"]);
    expect(t.agents[0]).toMatchObject({ current: 3, previous: 1, changePct: 200, booked: 1, department: "Marketing" });
    expect(t.agents[1]).toMatchObject({ current: 1, previous: 3, changePct: -66.7 });
  });
  it("ignores unknown agents and rows outside both windows", () => {
    expect(t.total).toMatchObject({ current: 4, previous: 4, changePct: 0, booked: 1 });
  });
  it("gives a null change when there is no previous period", () => {
    expect(t.agents[2]).toMatchObject({ current: 0, previous: 0, changePct: null });
  });
  it("rolls up departments and sources", () => {
    expect(t.departments.map((d) => d.department)).toEqual(["Marketing", "Sales", "Founder"]);
    expect(t.sources[0]).toMatchObject({ channel: "LinkedIn", count: 2, share: 50 });
    expect(t.agents[0].sources.find((s) => s.channel === "Direct")?.count).toBe(1);
  });
});

describe("views", () => {
  const withViews = (views: Array<{ agent_id: string; source: string | null; created_at: string }> | null) =>
    buildTraction(agents, [conv("a", 1)], 30, NOW, { views });
  it("counts views per period and the change", () => {
    const t = withViews([
      { agent_id: "a", source: null, created_at: daysAgo(1) },
      { agent_id: "a", source: null, created_at: daysAgo(2) },
      { agent_id: "a", source: null, created_at: daysAgo(3) },
      { agent_id: "a", source: null, created_at: daysAgo(40) },
      { agent_id: "b", source: null, created_at: daysAgo(1) },
    ]);
    expect(t.agents.find((a) => a.id === "a")).toMatchObject({ views: 3, viewsPrevious: 1, viewsChangePct: 200 });
    expect(t.agents.find((a) => a.id === "c")).toMatchObject({ views: 0, viewsPrevious: 0, viewsChangePct: null });
  });
  it("reports views as not recorded when there is no table yet", () => {
    expect(withViews(null).agents[0]).toMatchObject({ views: null, viewsPrevious: null, viewsChangePct: null });
  });
});

describe("placementsFor", () => {
  const agent = { companySlug: "acme", ending: "invest" };
  const posts: PostRow[] = [
    { id: "p1", title: "Meet Acme", body: "Meet Acme.", link_url: null, comment_text: "Chat with our IR agent: https://icapos.com/acme/invest?src=linkedin", status: "published", scheduled_at: null, created_at: daysAgo(5) },
    { id: "p2", title: null, body: "Other company post", link_url: "https://icapos.com/other/invest?src=linkedin", comment_text: null, status: "published", scheduled_at: null, created_at: daysAgo(4) },
    { id: "p3", title: null, body: "Draft about Acme\nsecond line", link_url: "https://icapos.com/acme/invest?src=facebook", comment_text: null, status: "draft", scheduled_at: null, created_at: daysAgo(1) },
  ];
  const variants: VariantRow[] = [
    { post_id: "p1", account_id: "x", status: "published", url: "https://linkedin.com/feed/update/1", published_at: daysAgo(5), comment_text: null },
    { post_id: "p1", account_id: "y", status: "queued", url: null, published_at: null, comment_text: null },
  ];
  const accounts = [{ id: "x", platform: "linkedin" }, { id: "y", platform: "facebook" }];

  it("finds the posts that carry this agent link, newest first", () => {
    const out = placementsFor(agent, posts, variants, accounts);
    expect(out.map((p) => p.postId)).toEqual(["p3", "p1", "p1"]);
  });
  it("links only published posts to the real post", () => {
    const out = placementsFor(agent, posts, variants, accounts).filter((p) => p.postId === "p1");
    expect(out.find((p) => p.network === "LinkedIn")).toMatchObject({ status: "Published", url: "https://linkedin.com/feed/update/1" });
    expect(out.find((p) => p.network === "Facebook")).toMatchObject({ status: "Scheduled", url: null });
  });
  it("shows a post with no network yet as a draft, titled from its first line", () => {
    expect(placementsFor(agent, posts, variants, accounts)[0]).toMatchObject({ status: "Draft", title: "Draft about Acme", url: null });
  });
  it("matches nothing for an agent without an address", () => {
    expect(placementsFor({ companySlug: null, ending: null }, posts, variants, accounts)).toEqual([]);
  });
});
