import { describe, it, expect, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ rpc }) }));

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
    expect(await resolveContactIds(null, { mode: "ids", ids: ["a", "b", "a"] })).toEqual(["a", "b"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("filter mode runs the same spec as the list through search_contact_ids", async () => {
    rpc.mockClear();
    rpc.mockResolvedValueOnce({ data: [{ search_contact_ids: "x" }, { search_contact_ids: "y" }], error: null });
    const params = new URLSearchParams({ filter: JSON.stringify({ match: "all", conditions: [{ field: "investorTypes", op: "in", value: ["Angel Investor"] }] }) });
    const ids = await resolveContactIds(null, { mode: "filter", params: params.toString(), group: "investor" }, "owner-1");
    expect(ids).toEqual(["x", "y"]);
    expect(rpc).toHaveBeenCalledWith("search_contact_ids", expect.objectContaining({
      p_owner: "owner-1",
      p_group_by: "profile",
      p_group_value: "investor",
      p_spec: { match: "all", conditions: [{ field: "investorTypes", op: "in", value: ["Angel Investor"] }] },
    }));
  });

  it("a database error throws instead of returning a partial set", async () => {
    rpc.mockClear();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(resolveContactIds(null, { mode: "filter", params: "q=acme" })).rejects.toThrow(/boom/);
  });

  it("a malformed filter throws instead of selecting the whole table", async () => {
    rpc.mockClear();
    await expect(resolveContactIds(null, { mode: "filter", params: "filter=%7Bnot-json" })).rejects.toThrow(/Invalid filter/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
