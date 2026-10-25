// The subscriber's view of a subscription package: what to read, what to sign, and where it stands.
// Pure (unit tested in steps.test.ts); rendered by app/contracts/[token]/PacketClient.tsx.

import type { PacketDoc } from "../packet";
import { PARTS } from "./package";

export type SubscriberStage = "sign" | "countersign" | "accepted";

export type SubscriberSteps = {
  /** Parts sent to read, in package order, each with its documents. */
  read: { partKey: string; label: string; docs: PacketDoc[] }[];
  /** Signature pages, in package order. */
  sign: PacketDoc[];
  signed: number;
  stage: SubscriberStage;
  /** Short line under the progress bar. */
  headline: string;
};

const partIndex = (key: string | null) => {
  const i = PARTS.findIndex((p) => p.key === key);
  return i < 0 ? PARTS.length : i;
};

/** True for a packet the Subscription package built (its documents carry a part). */
export function isSubscriptionPacket(docs: PacketDoc[]): boolean {
  return docs.length > 0 && docs.some((d) => d.partKey);
}

export function subscriberSteps(docs: PacketDoc[], acceptedAt: string | null): SubscriberSteps {
  const ordered = [...docs].sort((a, b) => partIndex(a.partKey) - partIndex(b.partKey));
  const sign = ordered.filter((d) => d.delivery === "sign");
  const signed = sign.filter((d) => d.status === "awaiting_countersign" || d.status === "signed").length;
  const executed = sign.length > 0 && sign.every((d) => d.status === "signed");
  const read: SubscriberSteps["read"] = [];
  for (const d of ordered.filter((x) => x.delivery !== "sign")) {
    const key = d.partKey ?? "other";
    let g = read.find((r) => r.partKey === key);
    if (!g) {
      g = { partKey: key, label: PARTS.find((p) => p.key === key)?.label ?? "Other documents", docs: [] };
      read.push(g);
    }
    g.docs.push(d);
  }
  const stage: SubscriberStage = acceptedAt ? "accepted" : sign.length > 0 && signed === sign.length ? "countersign" : "sign";
  const headline =
    stage === "accepted"
      ? "The Manager accepted your subscription. Follow the Subscription Instructions to fund."
      : stage === "countersign"
        ? executed
          ? "Signed by all parties. Waiting for the Manager to accept your subscription."
          : "You have signed every page. Waiting for the Manager to countersign and accept."
        : `${signed} of ${sign.length} signature page${sign.length === 1 ? "" : "s"} signed.`;
  return { read, sign, signed, stage, headline };
}
