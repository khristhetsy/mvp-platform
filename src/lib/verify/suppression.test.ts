import { describe, expect, it } from "vitest";
import { isSuppressed, unsubscribedEmails } from "./suppression";

function fakeDb(unsubs: string[], fail = false) {
  return {
    from: () => {
      const q = {
        _in: [] as string[],
        select: () => q,
        in: (_k: string, v: string[]) => { q._in = v; return q; },
        limit: () => q,
        then: (r: (v: unknown) => void) =>
          r(fail ? { data: null, error: { message: "boom" } } : { data: unsubs.filter((e) => q._in.includes(e)).map((email) => ({ email })), error: null }),
      };
      return q;
    },
  };
}

describe("suppression gate (D6)", () => {
  it("blocks the suppressed flag without a lookup", async () => {
    expect(await isSuppressed(fakeDb([]), { email: "a@x.com", suppressed: true })).toBe(true);
  });
  it("blocks an unsubscribed email in any case", async () => {
    expect(await isSuppressed(fakeDb(["jane@x.com"]), { email: "Jane@X.com" })).toBe(true);
    expect(await isSuppressed(fakeDb(["jane@x.com"]), { email: "bob@x.com" })).toBe(false);
  });
  it("fails closed when the list can't be read", async () => {
    expect(await isSuppressed(fakeDb([], true), { email: "bob@x.com" })).toBe(true);
  });
  it("no email, nothing to match", async () => {
    expect(await isSuppressed(fakeDb(["a@x.com"]), { email: null })).toBe(false);
  });
  it("bulk form returns lowercased matches", async () => {
    const s = await unsubscribedEmails(fakeDb(["jane@x.com"]), ["Jane@x.com", "bob@x.com", null]);
    expect([...s]).toEqual(["jane@x.com"]);
  });
});
