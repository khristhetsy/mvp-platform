import { describe, expect, it } from "vitest";
import { actingUserClient, actingUserId, runAsActingUser } from "./acting-user";

describe("scheduled send acting user", () => {
  it("is set only inside the replay", async () => {
    const client = { tag: "session" };
    expect(actingUserClient()).toBeNull();
    const seen = await runAsActingUser({ userId: "u1", client }, async () => {
      await Promise.resolve();
      return { client: actingUserClient(), id: actingUserId() };
    });
    expect(seen).toEqual({ client, id: "u1" });
    expect(actingUserClient()).toBeNull();
    expect(actingUserId()).toBeNull();
  });
});
