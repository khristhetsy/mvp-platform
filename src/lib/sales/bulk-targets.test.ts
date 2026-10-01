import { describe, it, expect, vi } from "vitest";

const { rpc, range, getSalesScope } = vi.hoisted(() => ({
  rpc: vi.fn(),
  // rpc(...).range(from, to): each range call resolves the next queued result.
  range: vi.fn(),
  // Scope: a plain rep sees only their own contacts; a manager may `viewAs` a rep.
  getSalesScope: vi.fn(async (caller: { id: string }, viewAs?: string | null) =>
    caller.id === "manager"
      ? { isManager: true, canViewTeam: true, canSeeAllContacts: true, ownerId: null, isSuperAdmin: false, viewOwnerId: viewAs ?? undefined }
      : { isManager: false, canViewTeam: false, canSeeAllContacts: false, ownerId: caller.id, isSuperAdmin: false, viewOwnerId: undefined }),
}));
// rpc("search_contact_id_array") resolves the next queued array result; the paged
// fallback (rpc("search_contact_ids").range(from, to)) resolves from `range`.
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ rpc: (name: string, args: unknown) => { const r = rpc(name, args); return name === "search_contact_ids" ? { range } : r; } }) }));
vi.mock("@/lib/sales/scope", async (orig) => ({ ...(await orig<typeof import("@/lib/sales/scope")>()), getSalesScope }));

const rep = { id: "rep-1" };
const manager = { id: "manager" };

import { csvCell, toCsv, resolveContactIds } from "./bulk-targets";

describe("csv", () => {
  it("quotes only when needed and doubles embedded quotes", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(["VC", "Angel"])).toBe("VC; Angel");
  });
  it("writes header then rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("resolveContactIds", () => {
  const ARR = "search_contact_id_array";
  const missingFn = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };

  it("de-dups an explicit id list without touching the database", async () => {
    rpc.mockReset();
    expect(await resolveContactIds(rep, { mode: "ids", ids: ["a", "b", "a"] })).toEqual(["a", "b"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("filter mode runs the same spec as the list, as one array", async () => {
    rpc.mockReset();
    rpc.mockResolvedValueOnce({ data: ["x", "y"], error: null });
    const params = new URLSearchParams({ filter: JSON.stringify({ match: "all", conditions: [{ field: "investorTypes", op: "in", value: ["Angel Investor"] }] }) });
    const ids = await resolveContactIds(rep, { mode: "filter", params: params.toString(), group: "investor" });
    expect(ids).toEqual(["x", "y"]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(ARR, expect.objectContaining({
      p_owner: "rep-1",
      p_group_by: "profile",
      p_group_value: "investor",
      p_limit: 25000,
      p_spec: { match: "all", conditions: [{ field: "investorTypes", op: "in", value: ["Angel Investor"] }] },
    }));
  });

  it("returns 13,030 ids from one call (no 1,000 row cap, no paging)", async () => {
    rpc.mockReset();
    rpc.mockResolvedValueOnce({ data: Array.from({ length: 13030 }, (_, i) => `id-${i}`), error: null });
    const ids = await resolveContactIds(rep, { mode: "filter", params: "q=acme" });
    expect(ids).toHaveLength(13030);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("retries once on a statement timeout", async () => {
    rpc.mockReset();
    rpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } })
      .mockResolvedValueOnce({ data: ["a"], error: null });
    expect(await resolveContactIds(rep, { mode: "filter", params: "q=acme" })).toEqual(["a"]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("a manager's viewAs inside params scopes the set like the list did", async () => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [], error: null });
    await resolveContactIds(manager, { mode: "filter", params: "q=acme&viewAs=rep-2" });
    expect(rpc).toHaveBeenCalledWith(ARR, expect.objectContaining({ p_owner: "rep-2" }));
    await resolveContactIds(manager, { mode: "filter", params: "q=acme" });
    expect(rpc).toHaveBeenLastCalledWith(ARR, expect.objectContaining({ p_owner: null }));
  });

  it("a database error throws instead of returning a partial set", async () => {
    rpc.mockReset();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(resolveContactIds(rep, { mode: "filter", params: "q=acme" })).rejects.toThrow(/boom/);
  });

  it("before the migration: falls back to paging search_contact_ids past the 1,000 row cap", async () => {
    rpc.mockReset(); range.mockReset();
    rpc.mockResolvedValueOnce(missingFn);
    const page = (start: number, n: number) => ({ data: Array.from({ length: n }, (_, i) => ({ search_contact_ids: `id-${start + i}` })), error: null });
    range.mockResolvedValueOnce(page(0, 1000)).mockResolvedValueOnce(page(1000, 1000)).mockResolvedValueOnce(page(2000, 30));
    const ids = await resolveContactIds(rep, { mode: "filter", params: "q=acme" });
    expect(ids).toHaveLength(2030);
    expect(new Set(ids).size).toBe(2030);
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("a malformed filter throws instead of selecting the whole table", async () => {
    rpc.mockReset();
    await expect(resolveContactIds(rep, { mode: "filter", params: "filter=%7Bnot-json" })).rejects.toThrow(/Invalid filter/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
