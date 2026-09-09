import { describe, it, expect } from "vitest";
import { makeBookingToken, verifyBookingToken } from "./tokens";

describe("booking action tokens", () => {
  it("round-trips a valid token for the matching action", () => {
    const tok = makeBookingToken("booking-123", "cancel");
    expect(verifyBookingToken(tok, "cancel")).toBe("booking-123");
  });

  it("rejects a token used for the wrong action", () => {
    const tok = makeBookingToken("booking-123", "cancel");
    expect(verifyBookingToken(tok, "reschedule")).toBeNull();
  });

  it("rejects an expired token", () => {
    const tok = makeBookingToken("booking-123", "cancel", Date.now() - 1000);
    expect(verifyBookingToken(tok, "cancel")).toBeNull();
  });

  it("rejects a tampered token", () => {
    const tok = makeBookingToken("booking-123", "cancel");
    const [body] = tok.split(".");
    expect(verifyBookingToken(`${body}.deadbeef`, "cancel")).toBeNull();
    expect(verifyBookingToken("garbage", "cancel")).toBeNull();
  });

  it("does not leak the id from a tampered body", () => {
    const forgedBody = Buffer.from(JSON.stringify({ id: "evil", a: "cancel", exp: Date.now() + 100000 })).toString("base64url");
    expect(verifyBookingToken(`${forgedBody}.x`, "cancel")).toBeNull();
  });
});
