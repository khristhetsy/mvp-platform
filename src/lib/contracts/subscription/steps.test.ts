import { describe, expect, it } from "vitest";
import type { PacketDoc } from "../packet";
import { isSubscriptionPacket, subscriberSteps } from "./steps";

const doc = (id: string, partKey: string, delivery: "sign" | "review", status: PacketDoc["status"]): PacketDoc => ({
  id, title: id, kind: "subscription", entity: null, pageCount: 2, status, expiresAt: null, showExpiry: false, signUrl: null, hasExecuted: false, partKey, delivery,
});

const docs = [
  doc("ppm", "ppm", "review", "shared"),
  doc("sig-a", "signature_pages", "sign", "sent"),
  doc("cover", "cover_index", "review", "shared"),
  doc("sig-b", "signature_pages", "sign", "sent"),
  doc("instr", "instructions", "review", "shared"),
];

describe("subscriber steps", () => {
  it("recognises a subscription packet, and not an ordinary one", () => {
    expect(isSubscriptionPacket(docs)).toBe(true);
    expect(isSubscriptionPacket([{ ...docs[0], partKey: null, delivery: null }])).toBe(false);
  });

  it("lists parts to read in package order and signature pages separately", () => {
    const s = subscriberSteps(docs, null);
    expect(s.read.map((r) => r.label)).toEqual(["Cover and Index", "Subscription Instructions", "Private Placement Memorandum"]);
    expect(s.sign.map((d) => d.id)).toEqual(["sig-a", "sig-b"]);
    expect(s.stage).toBe("sign");
    expect(s.headline).toBe("0 of 2 signature pages signed.");
  });

  it("counts a page signed once the subscriber has signed it, even before countersignature", () => {
    const s = subscriberSteps(docs.map((d) => (d.id === "sig-a" ? { ...d, status: "awaiting_countersign" as const } : d)), null);
    expect(s.signed).toBe(1);
    expect(s.stage).toBe("sign");
  });

  it("moves to waiting for the Manager when every page is signed, then to accepted", () => {
    const signed = docs.map((d) => (d.delivery === "sign" ? { ...d, status: "awaiting_countersign" as const } : d));
    expect(subscriberSteps(signed, null).stage).toBe("countersign");
    const done = docs.map((d) => (d.delivery === "sign" ? { ...d, status: "signed" as const } : d));
    const acc = subscriberSteps(done, "2026-10-25T10:00:00Z");
    expect(acc.stage).toBe("accepted");
    expect(acc.headline).toMatch(/Subscription Instructions/);
  });
});
