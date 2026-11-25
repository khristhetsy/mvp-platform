import { describe, expect, it } from "vitest";
import {
  classifyStripeLink,
  matchStripeLinks,
  parseStripeLinkInputs,
  stripeLinksToWrite,
  STRIPE_LINK_MAX_ROWS,
  type StripeLinkInput,
  type StripeLinkRow,
} from "./stripe-link-core";

const INPUT: StripeLinkInput = {
  ls_subscription_id: "1001",
  stripe_subscription_id: "sub_A",
  stripe_customer_id: "cus_A",
};

function row(over: Partial<StripeLinkRow> = {}): StripeLinkRow {
  return {
    id: "row-1",
    profile_id: "profile-1",
    plan_type: "founder_basic",
    subscription_status: "active",
    ls_subscription_id: "1001",
    stripe_subscription_id: null,
    stripe_customer_id: null,
    ...over,
  };
}

const NONE = { byLemon: null, byStripeSubscription: null, byStripeCustomer: null };

describe("parseStripeLinkInputs", () => {
  it("accepts the list itself or a rows wrapper", () => {
    expect(parseStripeLinkInputs([INPUT])).toEqual({ rows: [INPUT], invalid: [], error: null });
    expect(parseStripeLinkInputs({ rows: [INPUT] }).rows).toEqual([INPUT]);
  });

  it("accepts a numeric Lemon Squeezy id and trims text", () => {
    const parsed = parseStripeLinkInputs([{ ls_subscription_id: 1001, stripe_subscription_id: " sub_A ", stripe_customer_id: "cus_A" }]);
    expect(parsed.rows).toEqual([INPUT]);
  });

  it("refuses a body that is not a list", () => {
    for (const body of [null, "x", 3, {}, { rows: "nope" }]) {
      const parsed = parseStripeLinkInputs(body);
      expect(parsed.rows).toEqual([]);
      expect(parsed.error).toMatch(/JSON list/);
    }
  });

  it("refuses a list that is too long for one pass", () => {
    const many = Array.from({ length: STRIPE_LINK_MAX_ROWS + 1 }, (_, i) => ({
      ls_subscription_id: String(i),
      stripe_subscription_id: `sub_${i}`,
      stripe_customer_id: `cus_${i}`,
    }));
    const parsed = parseStripeLinkInputs(many);
    expect(parsed.rows).toEqual([]);
    expect(parsed.error).toMatch(/at most 500/);
  });

  it("reports a row with a missing or misshapen id and keeps the good ones", () => {
    const parsed = parseStripeLinkInputs([
      INPUT,
      { ls_subscription_id: "", stripe_subscription_id: "sub_B", stripe_customer_id: "cus_B" },
      { ls_subscription_id: "1003", stripe_subscription_id: "cus_C", stripe_customer_id: "sub_C" },
      "not a row",
    ]);
    expect(parsed.rows).toEqual([INPUT]);
    expect(parsed.invalid.map((i) => i.index)).toEqual([1, 2, 3]);
    expect(parsed.invalid[0].reason).toMatch(/ls_subscription_id is missing/);
    expect(parsed.invalid[1].reason).toMatch(/sub_.*cus_/);
  });

  it("leaves repeated ids in the list for the matcher to mark as conflicts", () => {
    const twice = [INPUT, { ...INPUT, ls_subscription_id: "1002" }];
    expect(parseStripeLinkInputs(twice)).toEqual({ rows: twice, invalid: [], error: null });
  });
});

describe("classifyStripeLink", () => {
  it("matches a Lemon Squeezy row that has no Stripe ids yet", () => {
    const result = classifyStripeLink(INPUT, { ...NONE, byLemon: row() });
    expect(result).toMatchObject({
      status: "matched",
      reason: null,
      subscription_id: "row-1",
      profile_id: "profile-1",
      plan_type: "founder_basic",
      ls_subscription_id: "1001",
      stripe_subscription_id: "sub_A",
      stripe_customer_id: "cus_A",
    });
  });

  it("matches when only the same Stripe customer is on the row already", () => {
    const existing = row({ stripe_customer_id: "cus_A" });
    expect(classifyStripeLink(INPUT, { ...NONE, byLemon: existing, byStripeCustomer: existing }).status).toBe("matched");
  });

  it("is unmatched when no row holds the Lemon Squeezy id or the Stripe subscription", () => {
    const result = classifyStripeLink(INPUT, NONE);
    expect(result.status).toBe("unmatched");
    expect(result.subscription_id).toBeNull();
    expect(result.reason).toMatch(/No subscription row/);
  });

  it("is already linked when the row carries exactly these Stripe ids", () => {
    const existing = row({ stripe_subscription_id: "sub_A", stripe_customer_id: "cus_A" });
    const result = classifyStripeLink(INPUT, { byLemon: existing, byStripeSubscription: existing, byStripeCustomer: existing });
    expect(result.status).toBe("already_linked");
    expect(result.subscription_id).toBe("row-1");
  });

  it("is already linked on a rerun after the webhook cleared the Lemon Squeezy id", () => {
    const synced = row({ ls_subscription_id: null, stripe_subscription_id: "sub_A", stripe_customer_id: "cus_A" });
    const result = classifyStripeLink(INPUT, { byLemon: null, byStripeSubscription: synced, byStripeCustomer: synced });
    expect(result.status).toBe("already_linked");
    expect(result.reason).toMatch(/already been cleared/);
  });

  it("is a conflict when the row already has a different Stripe subscription", () => {
    const result = classifyStripeLink(INPUT, { ...NONE, byLemon: row({ stripe_subscription_id: "sub_OTHER", stripe_customer_id: "cus_A" }) });
    expect(result.status).toBe("conflict");
    expect(result.reason).toMatch(/sub_OTHER/);
  });

  it("is a conflict when the row already has a different Stripe customer", () => {
    const result = classifyStripeLink(INPUT, { ...NONE, byLemon: row({ stripe_customer_id: "cus_OTHER" }) });
    expect(result.status).toBe("conflict");
    expect(result.reason).toMatch(/cus_OTHER/);
  });

  it("is a conflict when another row already holds the Stripe subscription or customer", () => {
    const other = row({ id: "row-2", ls_subscription_id: "2002", stripe_subscription_id: "sub_A", stripe_customer_id: "cus_A" });
    expect(classifyStripeLink(INPUT, { byLemon: row(), byStripeSubscription: other, byStripeCustomer: null }).status).toBe("conflict");
    expect(classifyStripeLink(INPUT, { byLemon: row(), byStripeSubscription: null, byStripeCustomer: other }).status).toBe("conflict");
  });

  it("is a conflict when the Stripe subscription sits on a row with another Lemon Squeezy id", () => {
    const other = row({ id: "row-2", ls_subscription_id: "2002", stripe_subscription_id: "sub_A", stripe_customer_id: "cus_A" });
    const result = classifyStripeLink(INPUT, { byLemon: null, byStripeSubscription: other, byStripeCustomer: other });
    expect(result.status).toBe("conflict");
    expect(result.reason).toMatch(/2002/);
  });
});

describe("matchStripeLinks", () => {
  it("classifies a whole list against the loaded rows", () => {
    const inputs: StripeLinkInput[] = [
      INPUT,
      { ls_subscription_id: "1002", stripe_subscription_id: "sub_B", stripe_customer_id: "cus_B" },
      { ls_subscription_id: "1003", stripe_subscription_id: "sub_C", stripe_customer_id: "cus_C" },
      { ls_subscription_id: "1004", stripe_subscription_id: "sub_D", stripe_customer_id: "cus_D" },
    ];
    const rows: StripeLinkRow[] = [
      row(),
      row({ id: "row-2", ls_subscription_id: "1002", stripe_subscription_id: "sub_B", stripe_customer_id: "cus_B" }),
      row({ id: "row-3", ls_subscription_id: "1003", stripe_subscription_id: "sub_ZZZ", stripe_customer_id: "cus_C" }),
    ];
    expect(matchStripeLinks(inputs, rows).map((o) => [o.ls_subscription_id, o.status])).toEqual([
      ["1001", "matched"],
      ["1002", "already_linked"],
      ["1003", "conflict"],
      ["1004", "unmatched"],
    ]);
  });

  it("marks both rows as conflicts when a Stripe subscription id is repeated", () => {
    const inputs: StripeLinkInput[] = [
      INPUT,
      { ls_subscription_id: "1002", stripe_subscription_id: "sub_A", stripe_customer_id: "cus_B" },
    ];
    const rows = [row(), row({ id: "row-2", profile_id: "profile-2", ls_subscription_id: "1002" })];
    const result = matchStripeLinks(inputs, rows);
    expect(result.map((o) => o.status)).toEqual(["conflict", "conflict"]);
    for (const o of result) expect(o.reason).toBe("This Stripe subscription appears more than once in the input.");
    expect(result.map((o) => o.subscription_id)).toEqual(["row-1", "row-2"]);
    expect(stripeLinksToWrite(result)).toEqual([]);
  });

  it("marks both rows as conflicts when a Lemon Squeezy id is repeated", () => {
    const inputs: StripeLinkInput[] = [
      INPUT,
      { ls_subscription_id: "1001", stripe_subscription_id: "sub_B", stripe_customer_id: "cus_B" },
    ];
    const result = matchStripeLinks(inputs, [row()]);
    expect(result.map((o) => o.status)).toEqual(["conflict", "conflict"]);
    for (const o of result) expect(o.reason).toBe("This Lemon Squeezy subscription id appears more than once in the input.");
    expect(stripeLinksToWrite(result)).toEqual([]);
  });

  it("marks rows sharing a Stripe customer as conflicts, even with different Lemon Squeezy ids", () => {
    const inputs: StripeLinkInput[] = [
      INPUT,
      { ls_subscription_id: "1002", stripe_subscription_id: "sub_B", stripe_customer_id: "cus_A" },
      { ls_subscription_id: "1003", stripe_subscription_id: "sub_C", stripe_customer_id: "cus_C" },
    ];
    const rows = [
      row(),
      row({ id: "row-2", ls_subscription_id: "1002" }),
      row({ id: "row-3", ls_subscription_id: "1003" }),
    ];
    const result = matchStripeLinks(inputs, rows);
    expect(result.map((o) => o.status)).toEqual(["conflict", "conflict", "matched"]);
    expect(result[0].reason).toMatch(/This Stripe customer appears more than once in the input/);
    expect(result[0].reason).toMatch(/not safe to link/);
    expect(stripeLinksToWrite(result).map((o) => o.ls_subscription_id)).toEqual(["1003"]);
  });

  it("names every duplicate when a row repeats more than one id", () => {
    const result = matchStripeLinks([INPUT, { ...INPUT }], [row()]);
    expect(result.map((o) => o.status)).toEqual(["conflict", "conflict"]);
    expect(result[0].reason).toMatch(/Stripe subscription appears more than once/);
    expect(result[0].reason).toMatch(/Lemon Squeezy subscription id appears more than once/);
    expect(result[0].reason).toMatch(/Stripe customer appears more than once/);
  });

  it("gives a list with no duplicates the same outcome as classifying each row alone", () => {
    const inputs: StripeLinkInput[] = [
      INPUT,
      { ls_subscription_id: "1002", stripe_subscription_id: "sub_B", stripe_customer_id: "cus_B" },
      { ls_subscription_id: "1004", stripe_subscription_id: "sub_D", stripe_customer_id: "cus_D" },
    ];
    const second = row({ id: "row-2", ls_subscription_id: "1002", stripe_subscription_id: "sub_OTHER" });
    const result = matchStripeLinks(inputs, [row(), second]);
    expect(result).toEqual([
      classifyStripeLink(inputs[0], { ...NONE, byLemon: row() }),
      classifyStripeLink(inputs[1], { ...NONE, byLemon: second }),
      classifyStripeLink(inputs[2], NONE),
    ]);
    expect(result.map((o) => o.status)).toEqual(["matched", "conflict", "unmatched"]);
  });
});

describe("stripeLinksToWrite", () => {
  it("returns matched rows only", () => {
    const matched = classifyStripeLink(INPUT, { ...NONE, byLemon: row() });
    const others = (["conflict", "unmatched", "already_linked"] as const).map((status) => ({ ...matched, status }));
    expect(stripeLinksToWrite([...others, matched])).toEqual([matched]);
  });

  it("never returns the same Stripe id or the same row twice", () => {
    const matched = classifyStripeLink(INPUT, { ...NONE, byLemon: row() });
    const sameSubscription = { ...matched, subscription_id: "row-2", stripe_customer_id: "cus_B" };
    const sameCustomer = { ...matched, subscription_id: "row-3", stripe_subscription_id: "sub_B" };
    const sameRow = { ...matched, stripe_subscription_id: "sub_C", stripe_customer_id: "cus_C" };
    expect(stripeLinksToWrite([matched, sameSubscription, sameCustomer, sameRow])).toEqual([matched]);
  });

  it("skips a matched outcome with no subscriptions row", () => {
    const matched = classifyStripeLink(INPUT, { ...NONE, byLemon: row() });
    expect(stripeLinksToWrite([{ ...matched, subscription_id: null }])).toEqual([]);
  });
});
