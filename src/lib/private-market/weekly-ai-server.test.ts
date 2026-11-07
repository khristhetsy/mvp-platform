import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const complete = vi.fn();
vi.mock("@/lib/claude", () => ({ claudeComplete: (...a: unknown[]) => complete(...a), CLAUDE_SONNET: "sonnet", isClaudeConfigured: () => true }));
const agents = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/ir-agent/store", () => ({
  getAgentById: async (id: string) => agents.get(id) ?? null,
  getTaughtAnswers: async () => [],
  getSourceTexts: async () => [],
}));
vi.mock("@/lib/ir-agent/wired", () => ({ wiredFactSheet: async () => "" }));
vi.mock("@/lib/supabase/admin", () => ({ serviceRoleClientUntyped: () => ({}) }));

import { loadPersona, writeOptions } from "./weekly-ai-server";
import type { DigestMarket } from "./weekly-digest";

const market: DigestMarket = {
  range: "r", asOfLabel: "a", avgCrr: 58,
  tiles: [{ label: "AVG CRR", value: "58.0", change: 7, delta: "+7.00" }],
  gainers: [], sectors: [], approvedTotal: 35, newlyApproved: { count: 10, scored: 2 }, moves: [],
};
const base = { action: "write" as const, audience: "founder" as const, agentId: null, target: "subject" as const, tone: "friendly" as const, factKeys: ["approved" as const], extra: "" };

beforeEach(() => {
  complete.mockReset();
  agents.clear();
  agents.set("live-1", { id: "live-1", status: "live", archived_at: null, company_name: "iCFO Capital", display_name: "Sam", agent_type: "sales", about: "We help founders raise.", organization_id: null, wired_excluded: [] });
  agents.set("draft-1", { id: "draft-1", status: "draft", archived_at: null, company_name: "Doyle Organics, LLC", display_name: "Doyle", agent_type: "founder", about: null, organization_id: null });
});

describe("loadPersona", () => {
  it("uses the default writer when no agent is picked", async () => {
    expect((await loadPersona(null))?.name).toBe("The iCapOS team");
    expect((await loadPersona("default"))?.system).toContain("iCapOS email writing assistant");
  });
  it("loads a live agent with its own voice", async () => {
    const p = await loadPersona("live-1");
    expect(p?.name).toBe("iCFO Capital");
    expect(p?.system).toContain("We help founders raise.");
    expect(p?.system).toContain("Never invent a figure");
  });
  it("refuses draft, paused or missing agents", async () => {
    expect(await loadPersona("draft-1")).toBeNull();
    expect(await loadPersona("nope")).toBeNull();
  });
});

describe("writeOptions", () => {
  it("returns only options that use the ticked figures", async () => {
    complete.mockResolvedValue(JSON.stringify({ options: ["10 companies approved this week", "Average rating hits 61.2", "A quiet week — 10 new"] }));
    const r = await writeOptions(base, market);
    expect(r).toEqual({ ok: true, options: ["10 companies approved this week", "A quiet week, 10 new"], writer: "The iCapOS team" });
  });
  it("says so when every option used a made up figure", async () => {
    complete.mockResolvedValue('{"options":["Rating is 99"]}');
    const r = await writeOptions(base, market);
    expect(r.ok).toBe(false);
  });
  it("needs at least one fact", async () => {
    const r = await writeOptions({ ...base, factKeys: [] }, market);
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(complete).not.toHaveBeenCalled();
  });
  it("will not write with a draft agent", async () => {
    const r = await writeOptions({ ...base, agentId: "draft-1" }, market);
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(complete).not.toHaveBeenCalled();
  });
  it("sends the agent's persona as the system prompt", async () => {
    complete.mockResolvedValue('{"options":["10 companies approved"]}');
    const r = await writeOptions({ ...base, agentId: "live-1" }, market);
    expect(r).toMatchObject({ ok: true, writer: "iCFO Capital" });
    expect(complete.mock.calls[0][1].system).toContain("iCFO Capital");
  });
  it("rewrites a selection and keeps merge fields", async () => {
    complete.mockResolvedValue('{"options":["Your rating is {rating}, see it now"]}');
    const r = await writeOptions({ action: "rewrite", audience: "founder", agentId: null, rewrite: "polish", text: "your rating is {rating} see it now" }, market);
    expect(r).toMatchObject({ ok: true, options: ["Your rating is {rating}, see it now"] });
    complete.mockResolvedValue('{"options":["See it now"]}');
    expect((await writeOptions({ action: "rewrite", audience: "founder", agentId: null, rewrite: "shorten", text: "your rating is {rating} see it now" }, market)).ok).toBe(false);
  });
});
