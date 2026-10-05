import { describe, expect, it } from "vitest";
import { isUnconfirmedGuess, NOT_GUESSED_FILTER } from "./sendable";

describe("send gate (D7)", () => {
  it("holds back pattern guesses only", () => {
    expect(isUnconfirmedGuess({ email_source: "profile" })).toBe(true);
    expect(isUnconfirmedGuess({ email_source: "given" })).toBe(false);
    expect(isUnconfirmedGuess({ email_source: "site" })).toBe(false);
    expect(isUnconfirmedGuess({ email_source: null })).toBe(false);
    expect(isUnconfirmedGuess({})).toBe(false);
  });
  it("the PostgREST filter keeps null sources", () => {
    expect(NOT_GUESSED_FILTER).toBe("email_source.is.null,email_source.neq.profile");
  });
});
