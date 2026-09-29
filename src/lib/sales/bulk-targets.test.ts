import { describe, it, expect, vi } from "vitest";

const { rpc, getSalesScope } = vi.hoisted(() => ({
  rpc: vi.fn(),
  // Scope: a plain rep sees only their own contacts; a manager may `viewAs` a rep.
  getSalesScope: vi.fn(async (caller: { id: string }, viewAs?: string | null) =>
    caller.id === "manager"
      ? { isManager: true, canViewTeam: true, canSeeAllContacts: true, ownerId: null, isSuperAdmin: false, viewOwnerId: viewAs ?? undefined }
      : { isManager: false, canViewTeam: false, canSeeAllContacts: false, ownerId: caller.id, isSuperAdmin: false, viewOwnerId: undefined }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ rpc }) }));
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
  it("de-dups an explicit id list without touching the database", async () => {
    rpc.mockClear();
    expect(await resolveContactIds(rep, { mode: "ids", ids: ["a", "b", "a"] })).toEqual(["a", "b"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("filter mode runs the same spec as the list through search_contact_ids", async () => {
    rpc.mockClear();
    rpc.mockResolvedValueOnce({ data: [{ search_contact_ids: "x" }, { search_contact_ids: "y" }], error: null });
    const params = new URLSearchParams({ filter: JSON.stringify({ match: "all", conditions: [{ field: "investorTypes", op: "in", value: ["Angel Investor"] }] }) });
    const ids = await resolveContactIds(rep, { mode: "filter", params: params.toString(), group: "investor" });
    expect(ids).toEqual(["x", "y"]);
    expect(rpc).toHaveBeenCalledWith("search_contact_ids", expect.objectContaining({
      p_owner: "rep-1",
      p_group_by: "profile",
      p_group_value: "investor",
      p_spec: { match: "all", conditions: [{ field: "investorTypes", op: "in", value: ["Angel Investor"] }] },
    }));
  });

  it("a manager's viewAs inside params scopes the set like the list did", async () => {
    rpc.mockClear();
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await resolveContactIds(manager, { mode: "filter", params: "q=acme&viewAs=rep-2" });
    expect(rpc).toHaveBeenCalledWith("search_contact_ids", expect.objectContaining({ p_owner: "rep-2" }));
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await resolveContactIds(manager, { mode: "filter", params: "q=acme" });
    expect(rpc).toHaveBeenLastCalledWith("search_contact_ids", expect.objectContaining({ p_owner: null }));
  });

  it("a database error throws instead of returning a partial set", async () => {
    rpc.mockClear();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(resolveContactIds(rep, { mode: "filter", params: "q=acme" })).rejects.toThrow(/boom/);
  });

  it("a malformed filter throws instead of selecting the whole table", async () => {
    rpc.mockClear();
    await expect(resolveContactIds(rep, { mode: "filter", params: "filter=%7Bnot-json" })).rejects.toThrow(/Invalid filter/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
